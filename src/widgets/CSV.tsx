declare global {
  interface Window {
    tokml: any;
  }
}

import { subclass, property } from '@arcgis/core/core/accessorSupport/decorators';
import Widget from '@arcgis/core/widgets/Widget';
import { tsx } from '@arcgis/core/widgets/support/widget';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import { SpatialReference, Point } from '@arcgis/core/geometry';
import { TextSymbol } from '@arcgis/core/symbols';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Papa from 'papaparse';

const CSS = {
  base: 'csv-widget',
  content: 'csv-widget--content',
};

let KEY = 0;

@subclass('CSV')
export default class CSV extends Widget {
  constructor(
    properties: esri.WidgetProperties & {
      view: esri.MapView;
    },
  ) {
    super(properties);

    // load tokml
    const tokml = document.createElement('script');
    tokml.src = 'https://cdn.jsdelivr.net/npm/tokml@latest/tokml.js';
    document.body.append(tokml);
  }

  postInitialize(): void {
    const {
      view: { map, popup },
      layer,
    } = this;

    map.add(layer);

    popup.defaultPopupTemplateEnabled = true;
  }

  view!: esri.MapView;

  protected layer = new GraphicsLayer();

  @property()
  protected state: 'ready' | 'processing' | 'select' | 'mapping' | 'mapped' = 'ready';

  private _results!: Papa.ParseResult<any>;

  private _fileInput!: HTMLInputElement;

  private _latitudeSelect: tsx.JSX.Element | null = null;

  private _longitudeSelect: tsx.JSX.Element | null = null;

  private _fileInputChange(event: Event): void {
    this.state = 'processing';

    const files = (event.target as HTMLInputElement).files;

    if (files && files[0]) {
      const reader = new FileReader();
      reader.onload = (event: any): void => {
        this._coordinateFieldSelect(Papa.parse(event.target.result, { header: true, skipEmptyLines: true }));
      };
      reader.readAsText(files[0]);
    } else {
      this.state = 'ready';
    }
  }

  private _coordinateFieldSelect(results: Papa.ParseResult<any>): void {
    this._results = results;

    const fields = results.meta.fields as string[];

    this._latitudeSelect = (
      <calcite-label key={KEY++}>
        Latitude field
        <calcite-select data-latitude-select="">
          {fields.map((field: string): tsx.JSX.Element => {
            return <calcite-option key={KEY++} label={field} value={field}></calcite-option>;
          })}
        </calcite-select>
      </calcite-label>
    );

    this._longitudeSelect = (
      <calcite-label key={KEY++}>
        Longitude field
        <calcite-select data-longitude-select="">
          {fields.map((field: string): tsx.JSX.Element => {
            return <calcite-option key={KEY++} label={field} value={field}></calcite-option>;
          })}
        </calcite-select>
      </calcite-label>
    );

    setTimeout((): void => {
      this.state = 'select';
    }, 2000);
  }

  private _mapData(event: Event): void {
    event.preventDefault();

    const {
      view,
      layer,
      _results: { data },
    } = this;

    this.state = 'mapping';

    const colors = ['#ed5151', '#149ece', '#a7c636', '#9e559c', '#fc921f', '#ffde3e'];

    const target = event.target as HTMLFormElement;

    const latitudeField = (target.querySelector('[data-latitude-select]') as HTMLCalciteSelectElement).selectedOption
      .value;

    const longitudeField = (target.querySelector('[data-longitude-select]') as HTMLCalciteSelectElement).selectedOption
      .value;

    const fieldInfos: { fieldName: string }[] = [];

    for (const attribute in data[0]) {
      fieldInfos.push({
        fieldName: attribute,
      });
    }

    data.forEach((attributes: { [key: string]: any }): void => {
      const latitude = attributes[latitudeField] || 0;

      const longitude = attributes[longitudeField] || 0;

      layer.add(
        new Graphic({
          geometry: new Point({
            x: longitude,
            y: latitude,
            // default...but be sure
            spatialReference: new SpatialReference({
              wkid: 4326,
            }),
          }),
          attributes,
          symbol: new TextSymbol({
            color: colors[Math.floor(Math.random() * colors.length)],
            text: '\ue61d',
            horizontalAlignment: 'center',
            verticalAlignment: 'bottom',
            font: {
              size: 24,
              family: 'CalciteWebCoreIcons',
            },
          }),
          popupTemplate: new PopupTemplate({
            title: 'Feature',
            outFields: ['*'],
            content: [
              {
                type: 'fields',
                fieldInfos,
              },
            ],
          }),
        }),
      );
    });

    setTimeout((): void => {
      view.goTo(layer.graphics);
      this.state = 'mapped';
    }, 2000);
  }

  private _download(event: Event): void {
    event.preventDefault();

    const { layer } = this;

    const target = event.target as HTMLFormElement;

    const format = (target.querySelector('[data-format-select]') as HTMLCalciteSelectElement).selectedOption.value as
      | 'kml'
      | 'geojson';

    const geoJSON: {
      type: string;
      features: any[];
    } = {
      type: 'FeatureCollection',
      features: [],
    };

    layer.graphics.forEach((graphic: Graphic): void => {
      const { geometry, attributes } = graphic;

      geoJSON.features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [(geometry as Point).longitude, (geometry as Point).latitude],
        },
        properties: attributes,
      });
    });

    const url = URL.createObjectURL(
      new Blob([format === 'kml' ? window.tokml(geoJSON) : JSON.stringify(geoJSON)], {
        type: format === 'kml' ? 'application/vnd' : 'application/geo+json',
      }),
    );

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.download = `csv_export.${format === 'kml' ? 'kml' : 'geojson'}`;
    document.body.append(a);
    a.click();
    a.remove();
  }

  private _clear(): void {
    const { layer } = this;

    layer.removeAll();

    this.state = 'ready';
  }

  render(): tsx.JSX.Element {
    const {
      state,
      layer: {
        graphics: { length },
      },
    } = this;

    return (
      <calcite-shell-panel class={CSS.base}>
        <calcite-panel heading="Comma Separated Values">
          <div class={CSS.content}>
            {/* state ready */}
            <div hidden={state !== 'ready'}>
              <p>
                Select a .csv file with a header row and fields populated with latitude and longitude in decimal
                degrees.
              </p>
              <calcite-button
                appearance="outline"
                width="full"
                icon-start="file-csv"
                afterCreate={(button: HTMLCalciteButtonElement): void => {
                  button.addEventListener('click', (): void => {
                    this._fileInput.click();
                  });
                }}
              >
                Select File
              </calcite-button>
              <input
                hidden=""
                type="file"
                accept="text/csv"
                afterCreate={(input: HTMLInputElement): void => {
                  this._fileInput = input;
                  input.addEventListener('change', this._fileInputChange.bind(this));
                }}
              ></input>
            </div>

            {/* processing */}
            <div hidden={state !== 'processing'}>{this._renderProgress('Processing file')}</div>

            {/* select fields */}
            <form
              hidden={state !== 'select'}
              afterCreate={(form: HTMLFormElement): void => {
                form.addEventListener('submit', this._mapData.bind(this));
              }}
            >
              <p>Select latitude and longitude fields.</p>
              {this._latitudeSelect}
              {this._longitudeSelect}
              <calcite-button type="submit" width="full" icon-start="pins">
                Map Data
              </calcite-button>
            </form>

            {/* mapping points */}
            <div hidden={state !== 'mapping'}>{this._renderProgress('Mapping data')}</div>

            {/* mapped points */}
            <div hidden={state !== 'mapped'}>
              <p>{length} points mapped.</p>
              <form
                afterCreate={(form: HTMLFormElement): void => {
                  form.addEventListener('submit', this._download.bind(this));
                }}
              >
                <calcite-label>
                  Format
                  <calcite-select data-format-select="">
                    <calcite-option label="KML" value="kml" checked=""></calcite-option>
                    <calcite-option label="GeoJSON" value="geojson"></calcite-option>
                  </calcite-select>
                </calcite-label>
                <calcite-button type="submit" width="full" icon-start="download">
                  Download
                </calcite-button>
              </form>
            </div>
          </div>
        </calcite-panel>
      </calcite-shell-panel>
    );
  }

  private _renderProgress(message: string): tsx.JSX.Element {
    return (
      <div key={KEY++}>
        <p>{message}</p>
        <calcite-progress type="indeterminate"></calcite-progress>
      </div>
    );
  }
}
