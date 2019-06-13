import React, { Component } from 'react';

import ReactSpeedometer from 'react-d3-speedometer';
import { TagCloud } from 'react-tagcloud';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

import throttle from 'lodash.throttle';

import DoodleCanvas from './DoodleCanvas';
import TensorView from './TensorView';

const CongratulatorySwal = withReactContent(Swal);

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 500;
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
        if (response.status === 200) {
          return response.json();
        }
        console.log(`/labels: HTTP status ${response.status}`);
        return null;
      }).then((result) => {
        const shuffledLabels = result.map(a => ({ sort: Math.random(), value: a }))
          .sort((a, b) => a.sort - b.sort)
          .map(a => a.value);
        this.setState({ shuffledLabels, targetIndex: 0 });
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
        return response.json();
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
            this.setState({ ...result.output, successfulInput: input });
            CongratulatorySwal.fire({
              title: <p>CONGRATULATIONS!</p>,
              footer: `This looks like ${promptText(target, false)}!`,
              html: <TensorView tensor={input} />,
              onClose: () => {
                this.setState(prevState => ({
                  targetIndex: prevState.targetIndex + 1,
                  successfulInput: null,
                  valueByLabel: {},
                  tags: [],
                }));
              }
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
        <header>
          DOODLE RECOGNITION
        </header>
        <div className="main">
          <div className="leftside">
            <h2>GET YOUR DOODLES RECOGNIZED HERE.</h2>
            <article>
              <p>
                Draw in the canvas, and a neural network will guess what you're drawing!
              </p>
              <p>It was trained using <a href="https://quickdraw.withgoogle.com">The Quick, Draw! Dataset</a> from Google,
                a downloadable database of 50 million doodles in 343 categories.
              </p>
              <p>
                My neural network is not as good as Google's! They have a server farm and I have an RTX 2060 video card.
                It identifies doodles correctly only 70% as often as they do. So you will have to draw carefully. Don't
                feel bad if you can't get your doodle recognized. With some of these things, I have no clue what it's looking for!
              </p>
              <p>
                This is a convolutional neural network with a very straightforward design. (Google uses a recurrent
                neural network that pays attention to the order of your strokes as you draw.)
                If you think you can do better, feel free to fork this project on <a href="http://gethub.com/jtiscione/doodle-recognition">Github.</a>
                The training script is written in Python and uses the Pytorch library. You can swap out my neural network
                model definition with your own. You will need to download about 20 GB of data from Google if you want to
                train your own network.
              </p>
            </article>
          </div>
          <DoodleCanvas
            title={`Draw ${promptText(target, true)}.`}
            target={target}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            sendPaintData={this.sendPaintData}
            resetPaintData={this.resetPaintData}
            onPencilDown={() => { this.pencilDown = true; }}
            onPencilUp={() => { this.pencilDown = false; }}
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
          <div className="rightSide">
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
            <div className="skip">
              <button type="button" className="next" onClick={this.onNext}>SKIP</button>
            </div>
          </div>
          <div className="padding" />
        </div>
      </div>
    );
  }
}

export default QuickDraw;
