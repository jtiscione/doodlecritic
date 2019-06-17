import React, { Component } from 'react';

import ReactSpeedometer from 'react-d3-speedometer';
import { TagCloud } from 'react-tagcloud';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

import debounce from 'lodash.debounce';
import throttle from 'lodash.throttle';

import DoodleCanvas from './DoodleCanvas';
import TensorView from './TensorView';

const CongratulatorySwal = withReactContent(Swal);

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 480;
const INPUT_WIDTH = 64;
const INPUT_HEIGHT = 64;

const promptText = (tgt, toUpperCase) => {
  if (tgt) {
    const label = toUpperCase ? tgt.toUpperCase() : tgt;
    if (tgt.match(/s$/) || tgt.match(/^The\s/)) {
      return label;
    }
    if (tgt.match(/^[aeiou]/)) {
      return `an ${label}`;
    }
    return `a ${label}`;
  }
  return '';
};

class QuickDraw extends Component {

  pencilDown = false;

  state = {
    targetIndex: -1,
    shuffledLabels: [],
    valueByLabel: {},
    tags: [],
    successfulInput: null,
  };

  error503Count = 0;
  mostRecentAward = null;

  constructor(props) {
    super(props);
    this.sendPaintData = throttle(this.sendPaintData, 1000, { leading: true, trailing: true }).bind(this);
    this.resetPaintData = this.resetPaintData.bind(this);
    this.onNext = this.onNext.bind(this);
  }

  componentDidMount() {
    if (!this.state.shuffledLabels.length) {
      console.log('Fetching labels...');
      fetch('/labels', { method: 'GET' }).then((response) => {
        if (response.status !== 200) {
          console.log(`/labels: HTTP status ${response.status}`);
          return null;
        }
        return response.json();
      }).then((result) => {
        if (result) {
          const shuffledLabels = result.map(a => ({ sort: Math.random(), value: a }))
            .sort((a, b) => a.sort - b.sort)
            .map(a => a.value);
          this.setState({ shuffledLabels, targetIndex: 0 });
        }
      }).catch((e) => {
        console.log(e);
      });
    }
  }

  onNext() {
    this.setState(prevState => ({
      targetIndex: prevState.targetIndex + 1,
      valueByLabel: {},
      tags: [],
    }));
  }

  sendPaintData(mainCanvas) {

    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = INPUT_WIDTH;
    miniCanvas.height = INPUT_HEIGHT;
    const miniContext = miniCanvas.getContext('2d');
    miniContext.fillStyle = DoodleCanvas.BACKGROUND_COLOR;
    miniContext.fillRect(0, 0, INPUT_WIDTH, INPUT_HEIGHT);
    miniContext.drawImage(mainCanvas, 0, 0, mainCanvas.width, mainCanvas.height, 0, 0, INPUT_WIDTH, INPUT_HEIGHT);
    const imageData = miniContext.getImageData(0, 0, INPUT_WIDTH, INPUT_HEIGHT);
    let input = '';
    for (let i = 0; i < imageData.data.length; i += 4) {
      const red = imageData.data[i];
      // The red/green/blue values are guaranteed to be 0 or 255 so just do this
      if (red === 255) {
        input += '0';
      } else {
        input += '1';
      }
    }
    // Send the image to the server, fetch result
    fetch('/paint', {
      method: 'POST',
      body: JSON.stringify({ input }),
      headers: { 'Content-Type': 'application/json' },
    }).then((response) => {
      if (response.status === 200) {
        this.error503Count = 0;
        return response.json();
      }
      if (response.status === 503) {
        // Heroku dyno asleep...
        this.error503Count++;
        if (this.error503Count === 3) {
          this.error503Count = 0;
          Swal.fire({
            title: '503 Error: Server not ready.',
            text: "(It probably just woke up and is restarting.)",
            type: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Reload Page',
            cancelButtonText: 'Ignore'
          }).then((result) => {
            if (result.value) {
              window.location.reload();
            }
          });
        }
      }
      console.log(`/paint: HTTP status ${response.status}`);
      return null;
    }).then((result) => {
      if (result) {
        if (this.pencilDown) {
          this.setState(result.output);
        } else {
          const target = this.state.shuffledLabels[this.state.targetIndex];
          const topTag = result.output.tags ? (result.output.tags[0] || '') : '';
          if (topTag && topTag.value === target && this.mostRecentAward !== target) {
            this.mostRecentAward = target;
            this.setState({...result.output, successfulInput: input});
            CongratulatorySwal.fire({
              title: <p>CONGRATULATIONS!</p>,
              footer: `Looks like ${promptText(target, false)} to me!`,
              html: <TensorView tensor={input}/>,
              onClose: () => {
                this.setState(prevState => ({
                  targetIndex: prevState.targetIndex + 1,
                  successfulInput: null,
                  valueByLabel: {},
                  tags: [],
                }));
              },
            });
          }
        }
      }
    }).catch((e) => {
      console.log(e);
    });
  }

  resetPaintData() {
    this.setState({ valueByLabel: {}, tags: [] });
  }

  render() {

    const target = this.state.shuffledLabels[this.state.targetIndex] || '';

    const { valueByLabel = {}, tags = [] } = this.state;
    const detectorValue = valueByLabel[target] || 0;

    return (
      <div className="QuickDraw">
        <div className="padding" />
        <div className="documentation">
          <article>
            <p>
            Draw something in the canvas, and a neural network will describe what it's seeing!
            </p>
            <p>
              <a href="https://quickdraw.withgoogle.com/">Google Quick Draw!</a> is an online game
              where you draw a doodle and their neural network tries to recognize it. Google has
              collected doodles from 15 million people.
            </p>
            <div className="pic">
              <div className="bck"/>
            </div>
            <p>
              I downloaded 20 gigabytes of doodles and used them to train my own neural network,
              on a PC with a budget NVidia RTX 2060 card. After 12 hours of training it agrees with
              Google's network 73% of the time.
            </p>
            <p>
              There is no time limit here, so you can explore its weird reactions to changes in
              the image at your leisure, and get some insights into what it's looking for.
            </p>
            <p>
              This project can be used with other convolutional neural networks, if you have one you'd like to try.
              See the <a target="blank" href="http://github.com/jtiscione/doodlecritic">repository</a> for details.
            </p>
          </article>
        </div>
        <DoodleCanvas
          title={promptText(target, true)}
          target={target}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          sendPaintData={this.sendPaintData}
          resetPaintData={this.resetPaintData}
          onPencilDown={() => { this.pencilDown = true; }}
          onPencilUp={() => { this.pencilDown = false; }}
          onNext={ this.onNext }
        />
        <div className="feedback">
          <div className="cloud-box">
            <TagCloud
              minSize={12}
              maxSize={35}
              tags={tags}
              colorOptions={{
                luminosity: 'light',
                hue: 'orange',
              }}
              className="simple-cloud"
            />
          </div>
          <div className="gauge-box">
            <ReactSpeedometer
              textColor="white"
              needleColor="white"
              startColor="gray"
              endColor="red"
              minValue={0}
              maxValue={1}
              segments={20}
              maxSegmentLabels={5}
              value={detectorValue}
              valueFormat=".0%"
            />
          </div>
          {target.toUpperCase()}
          &nbsp;DETECTOR
        </div>
        <div className="padding" />
      </div>
    );
  }
}

export default QuickDraw;
