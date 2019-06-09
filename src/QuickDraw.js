import React, { Component } from 'react';
import throttle from 'lodash.throttle';

import ReactSpeedometer from 'react-d3-speedometer';
import { TagCloud } from 'react-tagcloud';

import DoodleCanvas from './DoodleCanvas';

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 500;
const INPUT_WIDTH = 64;
const INPUT_HEIGHT = 64;

class QuickDraw extends Component {

  constructor(props) {
    super(props);
    this.sendPaintData = throttle(this.sendPaintData, 500, { leading: true, trailing: true }).bind(this);
    this.resetPaintData = this.resetPaintData.bind(this);
  }

  state = {
    valueByLabel: {},
    tags: [],
  };

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
        this.setState(result.output);
      }
    }).catch((e) => {
      console.log(e);
    });
  }

  resetPaintData() {
    this.setState({ valueByLabel: {}, tags: [] });
  }

  render() {
    const { valueByLabel = {}, tags = [] } = this.state;
    const detectorValue = valueByLabel['hexagon'] || 0;

    console.log(detectorValue);
    return (
      <div className="QuickDraw">
        <div className="padding" />
        <DoodleCanvas
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          sendPaintData={this.sendPaintData}
          resetPaintData={this.resetPaintData}
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
                  console.log(`moveTo(${x}, ${y})`);
                  ctx.moveTo(x, y);
                } else {
                  // i is always 255
                  console.log(`lineTo(${x}, ${y})`);
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
              shuffle={false}
              disableRandomColor
              tags={tags}
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
          HEXAGON DETECTOR
        </div>
        <div className="padding" />
      </div>
    );
  }


}

export default QuickDraw;
