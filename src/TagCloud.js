import React from 'react';
import PropTypes from 'prop-types';
import arrayShuffle from 'shuffle-array';
import randomColor from 'randomcolor';

function TagCloud({tags}) {

  const minSize = 10;
  const maxSize = 35;

  const values = tags.map(tag => tag.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const data = tags.map(tag => ({
    tag,
    color: tag.color || randomColor({
      luminosity: 'light',
      hue: 'orange',
    }),
    fontSize: minSize + Math.round(((tag.value - min) * (maxSize - minSize)) / (max - min)),
  }));

  const tagElements = arrayShuffle(data, { copy: true, rnd: null })
    .map(({tag, fontSize, color}) => {
      const key = tag.key || tag.label;
      const style = {
        margin: '0px 3px',
        verticalAlign: 'middle',
        display: 'inline-block',
        color,
        fontSize: `${fontSize}px`,
      };
      return <span style={style} key={key}>{tag.label}</span>;
    });
  return <div>{ tagElements }</div>;
}

TagCloud.propTypes = {
  tags: PropTypes.array.isRequired,
};

export default TagCloud;
