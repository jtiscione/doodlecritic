import React, { Component } from 'react';

class DoodleCanvas extends Component {

  isPainting = false;

  line = [];

  prevPos = { offsetX: 0, offsetY: 0 };

  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.endPaintEvent = this.endPaintEvent.bind(this);
  }

  paint(prevPos, currPos, strokeStyle) {
    const { offsetX, offsetY } = currPos;
    const { offsetX: x, offsetY: y } = prevPos;

    this.ctx.beginPath();
    this.ctx.xtrokeStyle = strokeStyle;
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(offsetX, offsetY);
    this.ctx.stroke();
    this.prevPos =  { offsetX, offsetY };
  }

  async sendPaintData() {
    const body = {
      line: this.line,
    };
    // We use the native fetch API to make requests to the server
    const req = await fetch('http://localhost:8000/paint', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    const _res = await req.json();
    this.line = [];
  }

  componentDidMount() {
    const canvas = this.canvasRef.current;
    if (canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.ctx.lineJoin = 'round';
      this.ctx.lineCap = 'round';
      this.ctx.lineWidth = 10;
    }
  }

  onMouseDown({ event }) {
    const { offsetX, offsetY } = event;
    this.isPainting = true;
    this.prevPos = { offsetX, offsetY };
  }

  onMouseMove({ event }) {
    if (this.isPainting) {
      const { offsetX, offsetY } = event;
      const offsetData = { offsetX, offsetY };
      // Set the start and stop of the position of the paint event
      const positionData = {
        start: { ...this.prevPos },
        stop: { ...offsetData },
      };
      // Add the position to the line array
      this.line = this.line.concat(positionData);
      this.paint(this.prevPos, offsetData, this.userStrokeStyle);
    }
  }

  endPaintEvent() {
    if (this.isPainting) {
      this.isPainting = false;
      this.sendPaintData();
    }
  }

  render() {
    return (
      <canvas
        width={512}
        height={512}
        ref={this.canvasRef}
        style={{ background: 'black' }}
        onMouseDown={this.onMouseDown}
        onMouseLeave={this.endPaintEvent}
        onMouseUp={this.endPaintEvent}
        onMouseMove={this.onMouseMove}
      />
    );
  }
}

export default DoodleCanvas;
