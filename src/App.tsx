import React, { Component } from 'react';

import './App.css';
import 'ol/ol.css';
import 'antd/dist/antd.css';
import './react-geo.css';
import busIcon from './static/icons/Aiga_bus_134138.svg'

import olFeature from 'ol/Feature';
import olGeomPoint from 'ol/geom/Point';
import OlMap from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import OlView from 'ol/View';
import OlLayerGroup from 'ol/layer/Group';
import OlLayerTile from 'ol/layer/Tile';
import OlLayerVector from 'ol/layer/Vector';
import OlSourceVector from 'ol/source/Vector';
import OlSourceOsm from 'ol/source/OSM';
import { Icon, Style } from 'ol/style.js';
import msgpack from "msgpack-lite";

import { Drawer } from 'antd';
import {
  LayerTree,
  MapComponent,
  NominatimSearch,
  SimpleButton
} from '@terrestris/react-geo';


const URL = "ws://127.0.0.1:5678/";


interface IPositionUpdate {
  id: number;
  line: string;
  lat: number;
  lon: number;
  type: number;
  tag?: number;
};

interface IPositionUpdateList {
  area: string;
  positions: IPositionUpdate[];
}

interface IState {
  updated?: Date;
  visible: boolean;
}
class App extends Component {
  private busIcon: any;
  private markersLayer: any;
  private layerGroup: any;
  private map: any;
  private ws = new WebSocket(URL);

  state: IState = {
    visible: false,
  };

  constructor(props: any) {
    super(props);

    // create feature layer and vector source
    this.markersLayer = new OlLayerVector({
      name: 'Real-time bus locations',
      source: new OlSourceVector({
        features: [],
      })
    });

    const layer = new OlLayerTile({
      name: 'OSM (OpenStreetMap)',
      source: new OlSourceOsm()
    });


    this.layerGroup = new OlLayerGroup({
      name: 'Layergroup',
      layers: [this.markersLayer]
    });

    // Default projection is EPSG:3857 (WGS 84 / Pseudo-Mercator)
    this.map = new OlMap({
      view: new OlView({
        center: fromLonLat([24.7536, 59.4370]),
        zoom: 16,
      }),
      layers: [layer, this.layerGroup]
    });

    this.map.on('postcompose', this.map.updateSize);
  }

  public componentDidMount() {
    this.ws.onopen = () => {
      // on connecting, do nothing but log it to the console
      console.log('connected')
    }

    this.ws.onmessage = evt => {
      // on receiving a message, add it to the list of messages
      const message = evt.data;
      // console.debug(msgpack.decode(new Uint8Array(message)));
      this.readBlob(message);
    }

    this.ws.onclose = () => {
      console.log('disconnected')
      // automatically try to reconnect on connection loss
      this.ws = new WebSocket(URL);
    }
  }

  toggleDrawer = () => {
    this.setState({ visible: !this.state.visible });
  }

  render() {
    return (
      <div className="App">
        <MapComponent
          map={this.map}
        />
        <SimpleButton
          style={{ position: 'fixed', top: '30px', right: '30px' }}
          onClick={this.toggleDrawer}
          icon="bars"
        />
        <Drawer
          title="react-geo-application"
          placement="right"
          onClose={this.toggleDrawer}
          visible={this.state.visible}
          mask={false}>
          <NominatimSearch
            countrycodes="ee"
            key="search"
            map={this.map}
          />
          <LayerTree
            layerGroup={this.layerGroup}
            map={this.map}
          />
          <span>Updated: {this.state.updated ? this.state.updated.toISOString() : ""}</span>
        </Drawer>
      </div>
    );
  }

  private readBlob = async (blob: Blob) => {
    const arrayBuffer: ArrayBuffer = await new Response(blob).arrayBuffer();
    console.debug("Received")
    this.updatePositions(msgpack.decode(new Uint8Array(arrayBuffer)));
    console.debug("Updated, features", this.markersLayer.getSource().getFeatures().length)
  }

  private updateMarker = (marker: any, positions: Map<number, IPositionUpdate>) => {
    const vehicleId = marker.getId();
    const update = positions.get(vehicleId);
    if (update) {
      const position = fromLonLat([update.lon, update.lat]);
      marker.getGeometry().setCoordinates(position);
    }

    return vehicleId;
  }

  private updatePositions = (positionUpdates: IPositionUpdateList) => {
    const positions = new Map<number, IPositionUpdate>();
    positionUpdates.positions.forEach(pos => {
      // Ignore unknown position
      if (!(pos.lat === 0 && pos.lon === 0)) {
        positions.set(pos.id, pos);
      }
    });

    const features = this.markersLayer.getSource().getFeatures();
    features.forEach((marker: any) => {
      positions.delete(this.updateMarker(marker, positions));
    });

    let markers: any = []
    var iter = positions.values()[Symbol.iterator]();
    for (const update of iter) {
      const marker = new olFeature({
        geometry: new olGeomPoint(fromLonLat([update.lon, update.lat])),
        name: update.line,
        vehicleId: update.id,
      });
      marker.set("vehicleId", update.id);
      marker.setId(update.id);
      marker.setStyle(new Style({
        image: new Icon(({
          anchor: [0.5, 46],
          anchorXUnits: 'fraction',
          anchorYUnits: 'pixels',
          scale: 0.05,
          src: busIcon
        }))
      }));
      markers.push(marker);
    }

    if (markers.length > 0) {
      try {
        this.markersLayer.getSource().addFeatures(markers);
        this.setState({ updated: new Date() })
      } catch (e) {
        console.error(e);
        console.debug("Changes:", [...positions.values()], "features:", markers);
      }
    }
  }
}

export default App;