import React, { Component } from 'react';

import { TagCloud } from 'react-tagcloud';

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 500;
const INPUT_WIDTH = 64;
const INPUT_HEIGHT = 64;

class DoodleCanvas extends Component {

  isPainting = false;

  prevPos = { offsetX: 0, offsetY: 0 };

  state = { tagData: [] };

  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.endPaintEvent = this.endPaintEvent.bind(this);
  }

  componentDidMount() {
    const canvas = this.canvasRef.current;
    if (canvas) {
      this.ctx = canvas.getContext('2d');
      this.ctx.lineJoin = 'round';
      this.ctx.lineCap = 'round';
      this.ctx.lineWidth = 10;
    }
  }

  onMouseDown(event) {
    const { offsetX, offsetY } = this.mousePosition(event);
    this.isPainting = true;
    this.prevPos = { offsetX, offsetY };
  }

  onMouseMove(event) {
    if (this.isPainting) {
      const { offsetX, offsetY } = this.mousePosition(event);
      const offsetData = { offsetX, offsetY };
      this.paint(this.prevPos, offsetData, 'white');
    }
  }

  onMouseEnter(event) {
    const canvas = this.canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.setState({ tagData: [] });
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
        input += '1';
      }
      // buffer += red.toString(16);
    }

    // We use the native fetch API to make requests to the server
    const response = await fetch('/paint', {
      method: 'POST',
      body: JSON.stringify({ input }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.status === 200) {
      const result = await response.json();
      const topFive = result.top_five;
      this.setState({ tagData: topFive });
    }
  }

  paint(prevPos, currPos, strokeStyle) {
    const { offsetX, offsetY } = currPos;
    const { offsetX: x, offsetY: y } = prevPos;
    this.ctx.filter = 'blur(4px)';
    this.ctx.beginPath();
    this.ctx.strokeStyle = strokeStyle;
    this.ctx.strokeWidth = 10;
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(offsetX, offsetY);
    this.ctx.stroke();
    this.prevPos =  { offsetX, offsetY };
  }

  mousePosition(evt) {
    const rect = this.canvasRef.current.getBoundingClientRect();
    return {
      offsetX: evt.clientX - rect.left,
      offsetY: evt.clientY - rect.top,
    };
  }

  endPaintEvent() {
    if (this.isPainting) {
      this.isPainting = false;
      this.sendPaintData();
    }
  }

  render() {
    const { tagData = [] } = this.state;
    return (
      <div>
        <canvas
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          ref={this.canvasRef}
          style={{ background: 'black' }}
          onMouseDown={this.onMouseDown}
          onMouseLeave={this.endPaintEvent}
          onMouseUp={this.endPaintEvent}
          onMouseMove={this.onMouseMove}
          onMouseEnter={this.onMouseEnter}
        />
        <TagCloud
          minSize={12}
          maxSize={35}
          tags={tagData}
          className="simple-cloud"
        />
      </div>
    );
  }
}

export default DoodleCanvas;
