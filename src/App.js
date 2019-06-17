import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';

import QuickDraw from './QuickDraw';

import './App.scss';

function App() {

  const [ readme, setReadme ] = useState(null);
  const [ showReadme, setShowReadme ] = useState(false);

  useEffect(() => {
    fetch('/readme', { method: 'GET' }).then((response) => {
      if (response.status !== 200) {
        console.log(`/readme: HTTP status ${response.status}`);
        return null;
      }
      return response.text();
    }).then((result) => {
      if (result) {
        setReadme(result);
      }
    }).catch((e) => {
      console.log(e);
    });
  });

  return (
    <div className="App">
      <header>
        <img src="/icon.png" />
        DOODLE CRITIC
      </header>
      <div className="main">
        <QuickDraw />
      </div>
      <div className="bottomLinks">
        <div className="leftEnd">Jason Tiscione</div>
        <div className="center"><a href="#readme" onClick={(_e)=>{ setShowReadme(!showReadme) }}>README.md</a></div>
        <div className="rightEnd"><a target="_blank" href="http://github.com/jtiscione/doodlecritic">Github repository</a></div>
      </div>
      <div className="cellar" id="readme">
        {
          (readme !== null && showReadme) ? <Markdown source={readme} className="readme" /> : <div />
        }
      </div>
    </div>
  );
}

export default App;
