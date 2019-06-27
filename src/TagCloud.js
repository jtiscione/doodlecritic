import React from 'react';
import PropTypes from 'prop-types';
import arrayShuffle from 'shuffle-array';
import randomColor from 'randomcolor';
import { fontSizeConverter, arraysEqual, propertiesEqual } from './helpers';

class TagCloud extends React.Component {

  componentWillReceiveProps(newProps) {
    const propsEqual = propertiesEqual(this.props, newProps, Object.keys(TagCloud.propTypes))
    const tagsEqual = arraysEqual(newProps.tags, this.props.tags);
    if (!tagsEqual || !propsEqual) {
      this._populate(newProps);
    }
  }

  componentWillMount() {
    this._populate(this.props);
  }

  render() {
    const tagElements = this._data.map(({tag, fontSize, color}) => {
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
    return (
      <div>
        { tagElements }
      </div>
    )
  }
  _populate(props) {
    const { tags } = props;

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
      fontSize: fontSizeConverter(tag.count, min, max, minSize, maxSize)
    }));
    this._data = arrayShuffle(data, { copy: true, rnd: null });
  }

}

TagCloud.propTypes = {
  tags: PropTypes.array.isRequired,
};

export default TagCloud;
