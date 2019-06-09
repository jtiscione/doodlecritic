import React, { Component } from 'react';
import throttle from 'lodash.throttle';

import { TagCloud } from 'react-tagcloud';

import DoodleCanvas from './DoodleCanvas';

const CANVAS_WIDTH = 384;
const CANVAS_HEIGHT = 384;
const INPUT_WIDTH = 64;
const INPUT_HEIGHT = 64;

class QuickDraw extends Component {

  constructor(props) {
    super(props);
    this.sendPaintData = throttle(this.sendPaintData, 500, { leading: true, trailing: true}).bind(this);
    this.resetPaintData = this.resetPaintData.bind(this);
  }

  state = { networkOutputs: [] };

  sendPaintData(mainCanvas) {

    const miniCanvas = document.createElement('canvas');

    miniCanvas.width = INPUT_WIDTH;
    miniCanvas.height = INPUT_HEIGHT;

    const miniContext = miniCanvas.getContext('2d');

    miniContext.drawImage(mainCanvas, 0, 0, mainCanvas.width, mainCanvas.height, 0, 0, INPUT_WIDTH, INPUT_HEIGHT);

    const imageData = miniContext.getImageData(0, 0, INPUT_WIDTH, INPUT_HEIGHT);
    let input = '';
    for (let i = 0; i < imageData.data.length; i += 4) {
      const red = imageData.data[i];
      // The red/green/blue values are guaranteed to be 0 or 255 so just do this
      if (red === 0) {
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
        const tags = result.tags;
        this.setState({ networkOutputs: tags });
      }
    }).catch((e) => {
      console.log(e);
    });
  }

  resetPaintData() {
    this.setState({ networkOutputs: [] });
  }

  render() {
    const { networkOutputs = [] } = this.state;
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
              ctx.strokeStyle = 'white';
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
        <div className="cloud-box">
          <TagCloud
            minSize={12}
            maxSize={35}
            tags={networkOutputs.map(e => ({ value: e.label, count: Math.round(1000 * e.value) }))}
            className="simple-cloud"
          />
        </div>
        <div className="padding" />
      </div>
    );
  }


}

export default QuickDraw;
