import React, { Component } from 'react';

import { TagCloud } from 'react-tagcloud';

const CANVAS_WIDTH = 256;
const CANVAS_HEIGHT = 256;
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
      this.ctx.lineWidth = 5;
      this.ctx.strokeWidth = 5;

      window.oncontextmenu = (function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
    }
  }

  onMouseDown(event) {
    event.preventDefault();

    // Send test data on right click
    if (event.button === 2) {
      this.sendTestPaintData();
      return;
    }

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
        // Not sure why red is guaranteed to be 255
        input += '1';
      }
    }

    // We use the native fetch API to make requests to the server
    const response = await fetch('/paint', {
      method: 'POST',
      body: JSON.stringify({ input }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.status === 200) {
      const result = await response.json();
      const tags = result.tags;
      this.setState({ tagData: tags });
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


  async sendTestPaintData() {
    // Draw a hexagon and send it
    this.ctx.beginPath();
    const centerX = 128;
    const centerY = 128;
    const r = 100;

    for (let i = 0; i <= 6; i++) {
      const angle = (2 * Math.PI) * (i / 6);
      const x = Math.round(centerX + r * Math.cos(angle));
      const y = Math.round(centerY - r * Math.sin(angle));
      this.ctx.strokeStyle = 'white';
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
    /*
    Server prints:
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000111111111111111111111111110000000000000000000
    0000000000000000001111111111111111111111111111000000000000000000
    0000000000000000001100000000000000000000000011000000000000000000
    0000000000000000011000000000000000000000000001100000000000000000
    0000000000000000011000000000000000000000000001100000000000000000
    0000000000000000110000000000000000000000000000110000000000000000
    0000000000000001110000000000000000000000000000111000000000000000
    0000000000000001100000000000000000000000000000011000000000000000
    0000000000000011000000000000000000000000000000001100000000000000
    0000000000000011000000000000000000000000000000001100000000000000
    0000000000000110000000000000000000000000000000000110000000000000
    0000000000000110000000000000000000000000000000000110000000000000
    0000000000001100000000000000000000000000000000000011000000000000
    0000000000011100000000000000000000000000000000000011100000000000
    0000000000011000000000000000000000000000000000000001100000000000
    0000000000110000000000000000000000000000000000000000110000000000
    0000000000110000000000000000000000000000000000000000110000000000
    0000000001100000000000000000000000000000000000000000011000000000
    0000000001100000000000000000000000000000000000000000011000000000
    0000000011000000000000000000000000000000000000000000001100000000
    0000000111000000000000000000000000000000000000000000001110000000
    0000000110000000000000000000000000000000000000000000000110000000
    0000001100000000000000000000000000000000000000000000000011000000
    0000001100000000000000000000000000000000000000000000000011000000
    0000000110000000000000000000000000000000000000000000000110000000
    0000000111000000000000000000000000000000000000000000001110000000
    0000000011000000000000000000000000000000000000000000001100000000
    0000000001100000000000000000000000000000000000000000011000000000
    0000000001100000000000000000000000000000000000000000011000000000
    0000000000110000000000000000000000000000000000000000110000000000
    0000000000110000000000000000000000000000000000000000110000000000
    0000000000011000000000000000000000000000000000000001100000000000
    0000000000011100000000000000000000000000000000000011100000000000
    0000000000001100000000000000000000000000000000000011000000000000
    0000000000000110000000000000000000000000000000000110000000000000
    0000000000000110000000000000000000000000000000000110000000000000
    0000000000000011000000000000000000000000000000001100000000000000
    0000000000000011000000000000000000000000000000001100000000000000
    0000000000000001100000000000000000000000000000011000000000000000
    0000000000000001110000000000000000000000000000111000000000000000
    0000000000000000110000000000000000000000000000110000000000000000
    0000000000000000011000000000000000000000000001100000000000000000
    0000000000000000011000000000000000000000000001100000000000000000
    0000000000000000001100000000000000000000000011000000000000000000
    0000000000000000001111111111111111111111111111000000000000000000
    0000000000000000000111111111111111111111111110000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    0000000000000000000000000000000000000000000000000000000000000000
    [ { value: 'windmill', count: 46 },
      { value: 'knee', count: 20 },
      { value: 'key', count: 5 },
      { value: 'fan', count: 5 },
      { value: 'door', count: 4 } ]
     */
  }

}

export default DoodleCanvas;
