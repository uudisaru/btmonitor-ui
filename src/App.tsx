import 'antd/dist/antd.css';
import 'ol/ol.css';
import './App.css';
import './react-geo.css';

import { Drawer } from 'antd';
import msgpack from 'msgpack-lite';
import olFeature from 'ol/Feature';
import olGeomPoint from 'ol/geom/Point';
import olBaseLayer from 'ol/layer/Base';
import olLayerGroup from 'ol/layer/Group';
import olLayerTile from 'ol/layer/Tile';
import olLayerVector from 'ol/layer/Vector';
import olMap from 'ol/Map';
import olMapBrowserEvent from 'ol/MapBrowserEvent';
import olOverlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';
import OlSourceOsm from 'ol/source/OSM';
import OlSourceVector from 'ol/source/Vector';
import { Icon, Style } from 'ol/style';
import olView from 'ol/View';
import React, { Component } from 'react';

import {
  LayerTree,
  MapComponent,
  NominatimSearch,
  SimpleButton
} from '@terrestris/react-geo';

import { buildSvg } from './icon';
import { updateTime } from './times';
import SvgBaselineCloudDone24Px from './icons/BaselineCloudDone24Px';
import SvgBaselineCloudOff24Px from './icons/BaselineCloudOff24Px';
import { wsUrl } from './urls';

const INITIAL_RETRY_INTERVAL = 1000;
const MAX_RETRY_INTERVAL = 1000 * 300; // 5 minutes

type OlBaseLayer = typeof olBaseLayer;
type OlFeature = typeof olFeature;
type OlMap = typeof olMap;
type OlMapBrowserEvent = typeof olMapBrowserEvent;
type OlView = typeof olView;
type OlLayerGroup = typeof olLayerGroup;
type OlLayerVector = typeof olLayerVector;
type OlOverlay = typeof olOverlay;
type OlStyle = typeof Style;

interface PositionUpdate {
  id: number;
  line: string;
  lat: number;
  lon: number;
  type: number;
  tag?: number;
}

interface PositionUpdateList {
  type: 'INI' | 'POS';
  area: string;
  positions: PositionUpdate[];
}

interface TrackExpiry {
  type: 'EXP';
  area: string;
  expired: number[];
}


interface AppState {
  connected: boolean;
  updated?: Date;
  visible: boolean;
}
class App extends Component<{}, AppState> {
  private layerGroup: OlLayerGroup;
  private markersLayer: OlLayerVector;
  private map: OlMap;
  private overlay: OlOverlay;
  private overlayFor?: number;
  private retryInterval = INITIAL_RETRY_INTERVAL;
  private view: OlView;
  private ws!: WebSocket;

  public state: AppState = {
    connected: false,
    visible: false
  };

  public constructor(props: {}) {
    super(props);

    // create feature layer and vector source
    this.markersLayer = new olLayerVector({
      name: 'Real-time bus locations',
      source: new OlSourceVector({
        features: []
      })
    });

    const layer = new olLayerTile({
      name: 'OSM (OpenStreetMap)',
      source: new OlSourceOsm()
    });

    this.layerGroup = new olLayerGroup({
      name: 'Layergroup',
      layers: [this.markersLayer]
    });

    // Default projection is EPSG:3857 (WGS 84 / Pseudo-Mercator)
    this.view = new olView({
      center: fromLonLat([24.7536, 59.437]),
      zoom: 16
    });
    this.map = new olMap({
      view: this.view,
      layers: [layer, this.layerGroup]
    });

    var currZoom = this.view.getZoom();
    this.map.on('moveend', (): void => {
      var newZoom = this.view.getZoom();
      if (currZoom !== newZoom) {
        this.updateZoom(currZoom, newZoom);
        currZoom = newZoom;
      }
    });

    this.map.on('postcompose', this.map.updateSize);
    this.connect();
  }

  public componentDidMount(): void {
    this.initOverlay();
  }

  public render(): JSX.Element {
    return (
      <div className="App">
        <MapComponent map={this.map} />
        <div id="popup" className="ol-popup">
          <div id="popup-content"></div>
        </div>
        <SimpleButton
          style={{ position: 'fixed', top: '30px', right: '30px' }}
          onClick={this.toggleDrawer}
          icon="bars"
        />
        <Drawer
          title={this.renderDrawerTitle()}
          placement="right"
          onClose={this.toggleDrawer}
          visible={this.state.visible}
          mask={false}
        >
          <NominatimSearch countrycodes="ee" key="search" map={this.map} />
          <LayerTree layerGroup={this.layerGroup} map={this.map} />
          <span>{updateTime(this.state.updated)}</span>
        </Drawer>
      </div>
    );
  }

  private busIcon = (line: string): OlStyle => {
    const icon = buildSvg(line);
    return new Style({
      image: new Icon({
        img: icon,
        imgSize: [794, 934],
        anchor: [0.5, 0.75],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        scale: this.zoomScale(this.view.getZoom())
      })
    });
  };

  private connect = (): void => {
    this.ws = new WebSocket(wsUrl());
    this.initWs();
  };

  private clearPositions(): void {
    this.markersLayer.getSource().clear();
  }

  private expireTracks(expired: TrackExpiry): void {
    const removed = new Set(expired.expired);
    //const removedFeatures: OlFeature[] = [];
    const features = this.markersLayer.getSource().getFeatures();
    const removedFeatures = features.filter((marker: OlFeature): boolean =>
      removed.has(marker.getId())
    );

    console.debug('Expire', removedFeatures.length, 'tracks');
    removedFeatures.forEach((marker: OlFeature): void =>
      this.markersLayer.getSource().removeFeature(marker)
    );
  }

  private initOverlay(): void {
    const container = document.getElementById('popup');

    this.overlay = new olOverlay({
      element: container,
      autoPan: true,
      autoPanAnimation: {
        duration: 250
      }
    });
    this.map.addOverlay(this.overlay);
    this.map.on('singleclick', (event: OlMapBrowserEvent): void => {
      const features = this.map.getFeaturesAtPixel(
        event.pixel,
        (layer: OlBaseLayer): boolean =>
          layer.get('name') === 'Real-time bus locations'
      );
      if (features) {
        const feature = features[0];
        this.overlayPosition(feature);
      } else {
        this.resetOverlay();
      }
    });
  }

  private initWs = (): void => {
    this.ws.onopen = (): void => {
      this.setState({ connected: true });
      this.retryInterval = INITIAL_RETRY_INTERVAL;
    };

    this.ws.onmessage = (evt): void => {
      const message = evt.data;
      this.readBlob(message);
    };

    this.ws.onclose = (): void => {
      this.setState({ connected: false });
      setTimeout(this.connect, this.retryInterval);
      if (this.retryInterval < MAX_RETRY_INTERVAL) {
        this.retryInterval = this.retryInterval * 2;
      }
    };
  };

  private overlayPosition = (feature: OlFeature): void => {
    const content = document.getElementById('popup-content');
    if (content) {
      content.innerHTML = `<b>Bus no. ${feature.get(
        'name'
      )}</b><br />${updateTime(feature.get('updated'))}`;
    }
    const pixelCoords = feature.getGeometry().getCoordinates();
    const offset = this.overlayOffset(this.view.getZoom());
    this.overlay.setPosition([pixelCoords[0], pixelCoords[1] + offset]);
    this.overlayFor = feature.getId();
  };

  private overlayOffset = (zoom: number): number => {
    let offset = 55;
    if (zoom > 20) {
      offset = 4;
    } else if (zoom > 19) {
      offset = 7;
    } else if (zoom > 18) {
      offset = 12;
    } else if (zoom > 17) {
      offset = 18;
    } else if (zoom > 16) {
      offset = 37;
    }

    return offset;
  };

  private readBlob = async (blob: Blob): Promise<void> => {
    const arrayBuffer: ArrayBuffer = await new Response(blob).arrayBuffer();
    const message = msgpack.decode(new Uint8Array(arrayBuffer));
    if (message.type === 'INI') {
      this.clearPositions();
    }
    if (message.type === 'POS' || message.type === 'INI') {
      this.updatePositions(message);
    } else if (message.type === 'EXP') {
      this.expireTracks(message);
    }
  };

  private renderDrawerTitle = (): JSX.Element => {
    const connectionStatus = this.state.connected ? (
      <SvgBaselineCloudDone24Px color="green" />
    ) : (
      <SvgBaselineCloudOff24Px color="red" />
    );
    return (
      <div className="drawer-title">
        <span>Tallinn Bus Traffic</span>
        {connectionStatus}
      </div>
    );
  };

  private resetOverlay = (): void => {
    this.overlay.setPosition(undefined);
    this.overlayFor = undefined;
  };

  private toggleDrawer = (): void => {
    this.setState({ visible: !this.state.visible });
  };

  private updateMarker = (
    marker: OlFeature,
    positions: Map<number, PositionUpdate>,
    updateTime: Date
  ): number => {
    const vehicleId = marker.getId();
    const update = positions.get(vehicleId);
    if (update) {
      const position = fromLonLat([update.lon, update.lat]);
      marker.getGeometry().setCoordinates(position);
      marker.set('updated', updateTime);
      if (update.line !== marker.get('name')) {
        marker.setStyle(this.busIcon(update.line));
      }
      if (this.overlayFor === vehicleId) {
        this.overlayPosition(marker);
      }
    }

    return vehicleId;
  };

  private updatePositions = (positionUpdates: PositionUpdateList): void => {
    const positions = new Map<number, PositionUpdate>();
    const updateTime = new Date();
    positionUpdates.positions.forEach((pos): void => {
      // Ignore unknown position
      if (!(pos.lat === 0 && pos.lon === 0)) {
        positions.set(pos.id, pos);
      }
    });

    const features = this.markersLayer.getSource().getFeatures();
    features.forEach((marker: OlFeature): void => {
      positions.delete(this.updateMarker(marker, positions, updateTime));
    });

    let markers: OlFeature[] = [];
    var iter = positions.values()[Symbol.iterator]();
    for (const update of iter) {
      const marker = new olFeature({
        geometry: new olGeomPoint(fromLonLat([update.lon, update.lat])),
        name: update.line,
        updated: updateTime,
        vehicleId: update.id
      });
      marker.set('vehicleId', update.id);
      marker.setId(update.id);
      marker.setStyle(this.busIcon(update.line));
      markers.push(marker);
    }

    if (markers.length > 0) {
      this.markersLayer.getSource().addFeatures(markers);
      this.setState({ updated: updateTime });
    }
  };

  private updateZoom = (currZoom: number, newZoom: number): void => {
    const currScale = this.zoomScale(currZoom);
    const newScale = this.zoomScale(newZoom);
    if (currScale !== newScale) {
      const features = this.markersLayer.getSource().getFeatures();
      features.forEach((marker: OlFeature): void => {
        const image = marker.getStyle().getImage();
        if (image) {
          image.setScale(newScale);
        }
      });

      this.markersLayer.getSource().refresh();
    }
  };

  private zoomScale(zoom: number): number {
    let scale = 0.04;
    if (zoom > 20) {
      scale = 0.085;
    } else if (zoom > 18) {
      scale = 0.065;
    } else if (zoom > 16) {
      scale = 0.05;
    }

    return scale;
  }
}

export default App;
