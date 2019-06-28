import React from 'react';
import PropTypes from 'prop-types';

import './TensorView.scss';

function TensorView({tensor}) {
  if (tensor) {
    const lines = tensor.match(/.{1,64}/g);
    if (lines && lines.length > 0) {
      return <div className="TensorView">
        <div className="lines">
        {
          lines.map((line) => {
            return <div className="line">
              {
                line.split('').map((digit) => {
                  if (digit === '1') {
                    return (<div className="one"/>);
                  }
                  return (<div className="zero"/>);
                })
              }
            </div>
          })
        }
        </div>
      </div>
    }
  }
  return <div className="TensorView">TensorView</div>
}

TensorView.propTypes = {
  tensor: PropTypes.string.isRequired,
};

export default TensorView;
