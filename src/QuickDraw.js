import React, { Component } from 'react';

import Markdown from 'react-markdown';
import ReactSpeedometer from 'react-d3-speedometer';
import { TagCloud } from 'react-tagcloud';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

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
    readme: null,
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
          console.log(`/labels: HTTP status ${response.status}`);
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
        <header>
          DOODLE CRITIC
        </header>
        <div className="main">
          <div className="leftside">
            {
              this.state.readme ? <Markdown source={this.state.readme} className="readme" /> : <div />
            }
            <h3>GET IMMEDIATE FEEDBACK ON YOUR ART.</h3>
            <article>
              <p>
                Draw in the canvas, and a neural network will guess what you're drawing!
              </p>
              <p>
                It was trained using <a href="https://quickdraw.withgoogle.com">The Quick, Draw! Dataset</a> from Google,
                a downloadable database of 50 million doodles separated into 343 categories.
              </p>
              <p>
                Try to be patient with its poor vision! This neural network is only 70% as accurate as the one at Google.
                They have a server farm and I have an RTX 2060 card with 6 GB. So this is actually not bad for a first
                attempt, but that remaining 30% is going to be a real pain.
              </p>
              <p>
                So you will have to draw carefully. Keep in mind that it has only seen doodles people have drawn
                in 20 seconds or less, and most people can't draw. And as soon as Google recognizes your doodle they
                snatch it and move on to the next before you can complete your drawing. If this network fails to
                recognize your doodle, drawing a Rembrandt is probably a waste of time.
              </p>
              <p>
                Some of the more annoying characteristics of neural networks are on display here. A few categories are
                easy to draw because the network has chosen them to be synonyms for "I don't know". Other categories are
                almost impossible. With many of them I have no clue what this thing is looking for.
              </p>
              <p>
                Google uses a recurrent neural network that notices the speed and timing of your strokes as you draw.
                This is a convolutional neural network with a conventional, vanilla design; it just looks at the image.
                If you think you can do better, feel free to fork this project on <a href="http://gethub.com/jtiscione/doodlecritic">Github</a>,&nbsp;
                and swap out this network's model structure with your own. The training script is written in Python
                using the Pytorch library. You will need to download about 20 GB of data from Google if you want to
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
