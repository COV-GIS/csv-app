import './main.scss';

// map, view and layers
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';

import ApplicationLayout from '@vernonia/application-layout/dist/ApplicationLayout';
import '@vernonia/application-layout/dist/ApplicationLayout.css';

import CSV from './widgets/CSV';
import './widgets/CSV.scss';

// app config and init loading screen
const title = 'Comma Separated Values';

// view
const view = new MapView({
  map: new Map({
    basemap: 'dark-gray-vector',
    layers: [],
    ground: 'world-elevation',
  }),
  zoom: 6,
  center: [-120.490556, 44.156944],
  constraints: {
    rotationEnabled: false,
  },
  popup: {
    dockEnabled: true,
    dockOptions: {
      position: 'bottom-left',
      breakpoint: false,
    },
  },
});

new ApplicationLayout({
  view,
  loaderOptions: {
    title,
  },
  contextualShellPanel: new CSV({
    view,
  }),
});

// view.when(() => { });
