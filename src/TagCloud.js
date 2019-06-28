import React from 'react';
import PropTypes from 'prop-types';
import arrayShuffle from 'shuffle-array';
import randomColor from 'randomcolor';

function TagCloud({tags}) {

  const minSize = 12;
  const maxSize = 35;

  const counts = tags.map(tag => tag.count),
    min = Math.min(...counts),
    max = Math.max(...counts);

  const data = tags.map(tag => ({
    tag,
    color: tag.color || randomColor({
      luminosity: 'light',
      hue: 'orange',
    }),
    fontSize: minSize + Math.round(((tag.count - min) * (maxSize - minSize)) / (max - min)),
  }));

  const tagElements = arrayShuffle(data, { copy: true, rnd: null })
    .map(({tag, fontSize, color}) => {
      const key = tag.key || tag.value;
      const style = {
        margin: '0px 3px',
        verticalAlign: 'middle',
        display: 'inline-block',
        color,
        fontSize: `${fontSize}px`,
      };
      return <span style={style} key={key}>{tag.value}</span>;
    });
  return <div>{ tagElements }</div>;
}

TagCloud.propTypes = {
  tags: PropTypes.array.isRequired,
};

export default TagCloud;
