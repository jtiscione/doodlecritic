import React, { Component } from 'react';

import Markdown from 'react-markdown';
import ReactSpeedometer from 'react-d3-speedometer';
import { TagCloud } from 'react-tagcloud';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

import throttle from 'lodash.throttle';
import debounce from 'lodash.debounce';

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
    readme: null,
    targetIndex: -1,
    shuffledLabels: [],
    valueByLabel: {},
    tags: [],
    successfulInput: null,
  };

  error503Count = 0;

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

    if (!this.state.readme) {
      console.log('Fetching README.md...');
      fetch('/readme', { method: 'GET' }).then((response) => {
        if (response.status !== 200) {
          console.log(`/readme: HTTP status ${response.status}`);
          return null;
        }
        return response.text();
      }).then((result) => {
        if (result) {
          this.setState({ readme: result });
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
          // Schedule reload for 1 sec
          setTimeout(() => {
            if (this.error503Count > 0) {
              // Nothing changed
              window.reload();
            }
          }, 1000);
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
          if (topTag && topTag.value === target) {
            const f = debounce(() => {
              this.setState({...result.output, successfulInput: input});
              CongratulatorySwal.fire({
                title: <p>CONGRATULATIONS!</p>,
                footer: `This looks like ${promptText(target, false)}!`,
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
            }, 500);
            f();
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
        <header>
          DOODLE CRITIC
        </header>
        <div className="main">
          <DoodleCanvas
            title={`Draw ${promptText(target, true)}.`}
            target={target}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            sendPaintData={this.sendPaintData}
            resetPaintData={this.resetPaintData}
            onPencilDown={() => { this.pencilDown = true; }}
            onPencilUp={() => { this.pencilDown = false; }}
            onNext={ this.onNext }
            drawTestPaintData={
              (ctx) => {
                ctx.beginPath();
                const centerX = CANVAS_WIDTH / 2;
                const centerY = CANVAS_WIDTH / 2;
                const r = CANVAS_WIDTH / 2.5; // ~100
                for (let i = 0; i <= 6; i++) {
                  const angle = (2 * Math.PI) * (i / 6);
                  const x = Math.round(centerX + r * Math.cos(angle));
                  const y = Math.round(centerY - r * Math.sin(angle));
                  if (i === 0) {
                    ctx.moveTo(x, y);
                  } else {
                    // i is always 255
                    ctx.lineTo(x, y);
                    ctx.stroke();
                  }
                }
              }
            }
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
          <div className="documentation">
            {
              this.state.readme ? <Markdown source={this.state.readme} className="readme" /> : <div />
            }
          </div>
        </div>
      </div>
    );
  }
}

export default QuickDraw;
