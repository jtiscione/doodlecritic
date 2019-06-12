import React, { Component } from 'react';

import ReactSpeedometer from 'react-d3-speedometer';
import { TagCloud } from 'react-tagcloud';
import SweetAlert from 'sweetalert2-react';

import throttle from 'lodash.throttle';

import DoodleCanvas from './DoodleCanvas';

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 500;
const INPUT_WIDTH = 64;
const INPUT_HEIGHT = 64;

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
          const topTag = result.output.tags ? (result.output.tags[0] || '') : '';
          if (topTag && topTag.value === this.state.shuffledLabels[this.state.targetIndex]) {
            this.setState({ ...result.output, successfulInput: input });
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

    const promptText = (tgt) => {
      if (tgt) {
        if (tgt.match(/s$/) || tgt.match(/^The\s/)) {
          return '';
        }
        if (tgt.match(/^[aeiou]/)) {
          return 'an ';
        }
        return 'a ';
      }
      return '';
    };

    const target = this.state.shuffledLabels[this.state.targetIndex] || '';

    const { valueByLabel = {}, tags = [] } = this.state;
    const detectorValue = valueByLabel[target] || 0;

    return (
      <div className="QuickDraw">
        <div className="prompt">
          {`Draw ${promptText(target)}`}
          <span>{target.toUpperCase() + '.'}</span>
        </div>
        <div className="main">
          <div className="leftside">
            <h2>QUICKDRAW</h2>
            <article>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</article>
          </div>
          <DoodleCanvas
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
        <SweetAlert
          show={this.state.successfulInput}
          title="TITLE"
          text={this.state.successfulInput}
          onConfirm={() => this.setState(prevState => ({
            targetIndex: prevState.targetIndex + 1,
            successfulInput: null,
            valueByLabel: {},
            tags: [],
          }))}
        />
      </div>
    );
  }


}

export default QuickDraw;
