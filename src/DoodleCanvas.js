import React, { Component } from 'react';

import PropTypes from 'prop-types';

const STROKE_WIDTH = 7;
const STROKE_COLOR = 'black';

const BACKGROUND_COLOR = 'white';

class DoodleCanvas extends Component {

  isPainting = false;

  prevPos = { offsetX: 0, offsetY: 0 };

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
      this.ctx.fillStyle = BACKGROUND_COLOR;
      this.ctx.strokeStyle = STROKE_COLOR;
      this.ctx.fillRect(0, 0, this.props.width, this.props.height);
    }
  }

  onMouseDown(event) {
    event.preventDefault();

    if (event.button === 2 && this.props.drawTestPaintData) {
      this.props.drawTestPaintData(this.ctx);
      this.props.sendPaintData(this.canvasRef.current);
      return;
    }

    const { offsetX, offsetY } = this.mousePosition(event);
    this.isPainting = true;
    this.prevPos = { offsetX, offsetY };
    this.paint(this.prevPos, this.prevPos, STROKE_COLOR);
  }

  onMouseMove(event) {
    if (this.isPainting) {
      const { offsetX, offsetY } = this.mousePosition(event);
      const offsetData = { offsetX, offsetY };
      this.paint(this.prevPos, offsetData, STROKE_COLOR);
    }
  }

  onMouseEnter(_event) {
    const canvas = this.canvasRef.current;
    const context = canvas.getContext('2d');
    context.fillStyle = BACKGROUND_COLOR;
    context.fillRect(0, 0, this.props.width, this.props.height);
    this.props.resetPaintData();
  }

  onMouseUp(_evt) {
    if (this.isPainting) {
      this.isPainting = false;
      this.props.sendPaintData(this.canvasRef.current);
    }
  }

  paint(prevPos, currPos, strokeStyle) {
    const { offsetX, offsetY } = currPos;
    const { offsetX: x, offsetY: y } = prevPos;
    // this.ctx.filter = 'blur(4px)';
    this.ctx.strokeStyle = strokeStyle;
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
        <canvas
          width={this.props.width}
          height={this.props.height}
          ref={this.canvasRef}
          onMouseDown={this.onMouseDown}
          onMouseLeave={this.onMouseUp}
          onMouseUp={this.onMouseUp}
          onMouseMove={this.onMouseMove}
          onMouseEnter={this.onMouseEnter}
        />
      </div>
    );
  }


}

DoodleCanvas.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  sendPaintData: PropTypes.func.isRequired,
  resetPaintData: PropTypes.func.isRequired,
  drawTestPaintData: PropTypes.func,
};

DoodleCanvas.defaultProps = { drawTestPaintData: (() => {}) };

export default DoodleCanvas;
