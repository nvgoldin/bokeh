import * as moment from "moment"
import {RemoteDataSource} from "./remote_data_source"
import {UpdateMode, HTTPMethod} from "core/enums"
import {logger} from "core/logging"
import * as p from "core/properties"

export namespace AjaxDataSource {
  export interface Attrs extends RemoteDataSource.Attrs {
    mode: UpdateMode
    content_type: string
    http_headers: {[key: string]: string}
    max_size: number
    method: HTTPMethod
    if_modified: boolean
    initial_minutes_offset: number
  }

  export interface Props extends RemoteDataSource.Props {}
}

export interface AjaxDataSource extends AjaxDataSource.Attrs {}

export class AjaxDataSource extends RemoteDataSource {

  properties: AjaxDataSource.Props

  constructor(attrs?: Partial<AjaxDataSource.Attrs>) {
    super(attrs)
  }

  static initClass(): void {
    this.prototype.type = 'AjaxDataSource'

    this.define({
      mode:         [ p.String, 'replace'          ],
      content_type: [ p.String, 'application/json' ],
      http_headers: [ p.Any,    {}                 ], // TODO (bev)
      max_size:     [ p.Number                     ],
      method:       [ p.String, 'GET'             ], // TODO (bev)  enum?
      if_modified:  [ p.Bool,   false              ],
      initial_minutes_offset: [p.Number, 20],
    })
  }

  protected interval: number
  protected initialized: boolean = false
  protected begin_timestamp: moment.Moment
  protected end_timestamp: moment.Moment


  destroy(): void {
    if (this.interval != null)
      clearInterval(this.interval)
    super.destroy()
  }

  setup(): void {
  if (!this.initialized) {
      this.end_timestamp = moment()
      this.begin_timestamp = moment(this.end_timestamp)
      this.begin_timestamp.subtract(this.initial_minutes_offset, 'minutes')
      console.log("initial set end timestamp: %s, begin timestamp: %s", this.end_timestamp.format(), this.begin_timestamp.format())
      this.initialized = true
      this.get_data(this.mode, this.max_size, this.if_modified) 
      if (this.polling_interval) {
         const callback = () => this.get_data(this.mode, this.max_size, this.if_modified)
         this.interval = setInterval(callback, this.polling_interval)
      }
    }
  }

  get_data(mode: UpdateMode, max_size: number = 0, _if_modified: boolean = false): void {
    const xhr = this.prepare_request()

    // TODO: if_modified
    xhr.addEventListener("load", () => this.do_load(xhr, mode, max_size))
    xhr.addEventListener("error", () => this.do_error(xhr))
    xhr.send()
  }

  prepare_request(): XMLHttpRequest {
    const xhr = new XMLHttpRequest()
    const request_url = encodeURI(this.data_url + "?begin=" + this.begin_timestamp.toISOString() + "&end=" + this.end_timestamp.toISOString())
    xhr.open(this.method, request_url, true)
    xhr.withCredentials = false
    xhr.setRequestHeader("Content-Type", this.content_type)

    const http_headers = this.http_headers
    for (const name in http_headers) {
      const value = http_headers[name]
      xhr.setRequestHeader(name, value)
    }

    return xhr
    }

  do_load(xhr: XMLHttpRequest, mode: UpdateMode, max_size: number): void {
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText)
      switch (mode) {
        case "replace": {
	  this.data = data
          break
        }
        case "append": {
          const original_data = this.data
          for (const column of this.columns()) {
            // XXX: support typed arrays
            const old_col = Array.from(original_data[column])
            const new_col = Array.from(data[column])
	    data[column] = old_col.concat(new_col).slice(-max_size)

	    }
	    this.data = data
       	    this.shift_timestamp()
          break
        }
    }
    }
  }
 
  shift_timestamp(): void {
      this.begin_timestamp = moment(this.end_timestamp)
      this.end_timestamp.add(this.polling_interval, 'ms')
      }

  set_next_timestamp(begin: moment.Moment, end: moment.Moment): void {
      this.begin_timestamp = moment(begin)
      this.end_timestamp = moment(end)
      }
  reload(): void {
      this.get_data("replace", this.max_size, this.if_modified) 
  }




  do_error(xhr: XMLHttpRequest): void {
    logger.error(`Failed to fetch JSON from ${this.data_url} with code ${xhr.status}`)
  }
}
AjaxDataSource.initClass()
