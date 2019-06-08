import React, { Component } from 'react';

import { TagCloud } from 'react-tagcloud';

const CANVAS_WIDTH = 384;
const CANVAS_HEIGHT = 384;
const INPUT_WIDTH = 64;
const INPUT_HEIGHT = 64;

const STROKE_WIDTH = 7;

class QuickDraw extends Component {

  isPainting = false;

  prevPos = { offsetX: 0, offsetY: 0 };

  state = { networkOutputs: [] };

  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
  }

  componentDidMount() {
    const canvas = this.canvasRef.current;
    if (canvas) {
      this.ctx = canvas.getContext('2d');
      this.ctx.lineJoin = 'round';
      this.ctx.lineCap = 'round';
      this.ctx.lineWidth = STROKE_WIDTH;
      this.ctx.strokeWidth = STROKE_WIDTH;
      this.ctx.filter = 'blur(1px)';
    }
  }

  onMouseDown(event) {
    event.preventDefault();

    if (event.button === 2) {
      this.sendTestPaintData();
      return;
    }

    const { offsetX, offsetY } = this.mousePosition(event);
    this.isPainting = true;
    this.prevPos = { offsetX, offsetY };
    this.paint(this.prevPos, this.prevPos, 'white');
  }

  onMouseMove(event) {
    if (this.isPainting) {
      const { offsetX, offsetY } = this.mousePosition(event);
      const offsetData = { offsetX, offsetY };
      this.paint(this.prevPos, offsetData, 'white');
    }
  }

  onMouseEnter(_event) {
    const canvas = this.canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.setState({ networkOutputs: [] });
  }

  onMouseUp(_evt) {
    if (this.isPainting) {
      this.isPainting = false;
      this.sendPaintData();
    }
  }

  async sendPaintData() {

    const mainCanvas = this.canvasRef.current;
    const miniCanvas = document.createElement('canvas');

    miniCanvas.width = INPUT_WIDTH;
    miniCanvas.height = INPUT_HEIGHT;

    const miniContext = miniCanvas.getContext('2d');

    miniContext.drawImage(mainCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0, 0, INPUT_WIDTH, INPUT_HEIGHT);

    const imageData = miniContext.getImageData(0, 0, INPUT_WIDTH, INPUT_HEIGHT);
    let input = '';
    for (let i = 0; i < imageData.data.length; i += 4) {
      const red = imageData.data[i];
      if (red === 0) {
        input += '0';
      } else {
        // Not sure why red is guaranteed to be 255
        input += '1';
      }
    }

    // Send the image to the server, fetch result
    const response = await fetch('/paint', {
      method: 'POST',
      body: JSON.stringify({ input }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.status === 200) {
      const result = await response.json();
      const tags = result.tags;
      this.setState({ networkOutputs: tags });
    }
  }

  paint(prevPos, currPos, strokeStyle) {
    const { offsetX, offsetY } = currPos;
    const { offsetX: x, offsetY: y } = prevPos;
    // this.ctx.filter = 'blur(4px)';
    this.ctx.beginPath();
    this.ctx.strokeStyle = strokeStyle;
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(offsetX, offsetY);
    this.ctx.stroke();
    this.prevPos = { offsetX, offsetY };
  }

  mousePosition(evt) {
    const rect = this.canvasRef.current.getBoundingClientRect();
    return {
      offsetX: evt.clientX - rect.left,
      offsetY: evt.clientY - rect.top,
    };
  }

  async sendTestPaintData() {
    // Draw a test hexagon and send it
    this.ctx.beginPath();
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_WIDTH / 2;
    const r = CANVAS_WIDTH / 2.5; // ~100
    this.ctx.strokeStyle = 'white';

    for (let i = 0; i <= 6; i++) {
      const angle = (2 * Math.PI) * (i / 6);
      const x = Math.round(centerX + r * Math.cos(angle));
      const y = Math.round(centerY - r * Math.sin(angle));
      if (i === 0) {
        console.log(`moveTo(${x}, ${y})`);
        this.ctx.moveTo(x, y);
      } else {
        // i is always 255
        console.log(`lineTo(${x}, ${y})`);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
      }
    }
    /*
    Prints:
    moveTo(228, 128)
    lineTo(178, 41)
    lineTo(78, 41)
    lineTo(28, 128)
    lineTo(78, 215)
    lineTo(178, 215)
    lineTo(228, 128)
    */
    this.sendPaintData();
  }

  render() {
    const { networkOutputs = [] } = this.state;
    return (
      <div className="QuickDraw">
        <div className="padding" />
        <canvas
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          ref={this.canvasRef}
          style={{ background: 'black' }}
          onMouseDown={this.onMouseDown}
          onMouseLeave={this.onMouseUp}
          onMouseUp={this.onMouseUp}
          onMouseMove={this.onMouseMove}
          onMouseEnter={this.onMouseEnter}
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
