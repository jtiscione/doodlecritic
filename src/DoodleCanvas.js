import React, { Component } from 'react';

import PropTypes from 'prop-types';

const STROKE_WIDTH = 7;
const STROKE_COLOR = 'black';

const BACKGROUND_COLOR = 'white';

class DoodleCanvas extends Component {

  pencilDown = false;

  eraseMode = false;

  prevPos = { offsetX: 0, offsetY: 0 };

  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onDrawMode = this.onDrawMode.bind(this);
    this.onEraseMode = this.onEraseMode.bind(this);
    this.onClear = this.onClear.bind(this);
    this.onNext = this.onNext.bind(this);
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
      this.ctx.fillStyle = BACKGROUND_COLOR;
      this.ctx.strokeStyle = STROKE_COLOR;
      this.ctx.fillRect(0, 0, this.props.width, this.props.height);
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.target !== prevProps.target) {
      this.ctx.fillRect(0, 0, this.props.width, this.props.height);
    }
  }

  onMouseDown(event) {
    event.preventDefault();
    this.pencilDown = true;
    this.props.onPencilDown();
    const { offsetX, offsetY } = this.mousePosition(event);
    this.prevPos = { offsetX, offsetY };
    this.paint(this.prevPos, this.prevPos);
  }

  onTouchStart(event) {
    event.preventDefault();
    this.pencilDown = true;
    this.props.onPencilDown();
    event.targetTouches.forEach((touch, i) => {
      const { offsetX, offsetY } = this.mousePosition(touch);
      if (i === 0) {
        this.prevPos = { offsetX, offsetY };
      }
      this.paint(this.prevPos, { offsetX, offsetY });
    });
  }

  onMouseMove(event) {
    event.preventDefault();
    if (this.pencilDown) {
      const { offsetX, offsetY } = this.mousePosition(event);
      const offsetData = { offsetX, offsetY };
      this.paint(this.prevPos, offsetData);
    }
  }

  onTouchMove(event) {
    event.preventDefault();
    if (this.pencilDown) {
      event.targetTouches.forEach((touch) => {
        const { offsetX, offsetY } = this.mousePosition(touch);
        this.paint(this.prevPos, { offsetX, offsetY });
      });
    }
  }

  onDrawMode(_event) {
    this.eraseMode = false;
    this.canvasRef.current.style.cursor = 'url(/pencil.cur), default';
  }

  onEraseMode(_event) {
    this.eraseMode = true;
    this.canvasRef.current.style.cursor = 'url(/eraser.cur) 16 16, default';
  }

  onClear(_event) {
    const canvas = this.canvasRef.current;
    const context = canvas.getContext('2d');
    context.fillStyle = BACKGROUND_COLOR;
    context.fillRect(0, 0, this.props.width, this.props.height);
    this.props.resetPaintData();
    this.eraseMode = false;
    this.canvasRef.current.style.cursor = 'url(/pencil.cur), default';
  }

  onMouseUp(_evt) {
    if (this.pencilDown) {
      this.pencilDown = false;
      this.props.onPencilUp();
      this.props.sendPaintData(this.canvasRef.current);
    }
  }

  onNext(_evt) {
    this.canvasRef.current.style.cursor = 'url(/pencil.cur), default';
    this.eraseMode = false;
    this.props.onNext();
  }

  paint(prevPos, currPos) {
    const { offsetX, offsetY } = currPos;
    const { offsetX: x, offsetY: y } = prevPos;
    // this.ctx.filter = 'blur(4px)';
    this.ctx.strokeStyle = STROKE_COLOR;
    this.ctx.lineWidth = STROKE_WIDTH;
    this.ctx.strokeWidth = STROKE_WIDTH;
    if (this.eraseMode) {
      this.ctx.strokeStyle = BACKGROUND_COLOR;
      this.ctx.lineWidth = 3.6 * STROKE_WIDTH;
      this.ctx.strokeWidth = 3.6 * STROKE_WIDTH;
    }
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(offsetX, offsetY);
    this.ctx.stroke();
    this.prevPos = { offsetX, offsetY };
    this.props.sendPaintData(this.canvasRef.current);
  }

  mousePosition(evt) {
    const rect = this.canvasRef.current.getBoundingClientRect();
    return {
      offsetX: evt.clientX - rect.left,
      offsetY: evt.clientY - rect.top,
    };
  }

  render() {
    return (
      <div className="DoodleCanvas">
        <div className="title">CHALLENGE: Draw {this.props.article}<a
          href="#"
          title={`See what people draw for ${this.props.target}`}
          onClick={
          () => window.open(
            `https://quickdraw.withgoogle.com/data/${this.props.target.replace(/ /g, '_')}`,
            '_blank')}>{this.props.target.toUpperCase()}</a>.</div>
        <canvas
          width={this.props.width}
          height={this.props.height}
          ref={this.canvasRef}
          onMouseDown={this.onMouseDown}
          onMouseLeave={this.onMouseUp}
          onMouseUp={this.onMouseUp}
          onMouseMove={this.onMouseMove}
          onTouchStart={this.onTouchStart}
          onTouchMove={this.onTouchMove}
          onTouchEnd={this.onMouseUp}
        />
        <div className="toolbar">
          <button type="button" className="button" onClick={this.onDrawMode}>DRAW</button>
          <button type="button" className="button" onClick={this.onEraseMode}>ERASE</button>
          <button type="button" className="button" onClick={this.onClear}>CLEAR</button>
          <div className="spacer" />
          <button type="button" className="button" onClick={this.onNext}>SKIP</button>
        </div>
      </div>
    );
  }
}

DoodleCanvas.propTypes = {
  article: PropTypes.string.isRequired,
  target: PropTypes.string.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  sendPaintData: PropTypes.func.isRequired,
  resetPaintData: PropTypes.func.isRequired,
  onPencilDown: PropTypes.func.isRequired,
  onPencilUp: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
};

export default DoodleCanvas;
