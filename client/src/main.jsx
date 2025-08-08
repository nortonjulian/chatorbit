import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { BrowserRouter } from 'react-router-dom';
import { UserProvider } from './context/UserContext.jsx';
import App from './App.jsx';

const theme = {
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  defaultRadius: 'lg',
  colors: {
    orbit: ['#e7f1ff','#c9dfff','#a9ccff','#86b6ff','#63a0ff','#418aff','#2f73e6','#255bb4','#1b4483','#122c52'],
    orbitYellow: ['#fff9e6','#ffefbf','#ffe596','#ffdb6b','#ffd241','#ffc818','#e0ab00','#b38700','#856400','#573e00'],
  },
  primaryColor: 'orbit',
  primaryShade: 6,
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <MantineProvider theme={theme} defaultColorScheme="light">
    <Notifications position="top-right" />
    <BrowserRouter>
      <UserProvider>
        <App />
      </UserProvider>
    </BrowserRouter>
  </MantineProvider>
);
