import {inject} from 'aurelia-framework';
import {HttpClient} from 'aurelia-fetch-client';
import {bindable} from 'aurelia-framework';
import * as d3 from'd3';
import * as $ from 'jquery';
import 'jquery-ui-dist';

@inject(HttpClient)
export class Home {
  estimatedPrice: number;
  prices: any;
  http: HttpClient;
  heading = 'Estimating future stock prices';
  baseUrl = 'http://localhost:8083';

  @bindable ticker = "msft";
  @bindable till = this.daysFromNow(7);
  @bindable since = "2014-09-09";
  tickers = ["msft", "googl", "amzn", "aapl"];

  constructor(http: HttpClient) {
    this.http = http;

    this.isApiAvailable('http://localhost:8083')
      .then(isAvailable => {
        if (isAvailable) {
          throw new Error('available api found');
        }
        
        this.isApiAvailable('http://stockestimator.westus.cloudapp.azure.com')
          .then(isAvailable => {
            if (isAvailable) {
              this.baseUrl = 'http://stockestimator.westus.cloudapp.azure.com';
              throw new Error('available api found');
            }
            
            this.isApiAvailable('http://104.196.239.135')
              .then(isAvailable => {
                if (isAvailable) {
                  this.baseUrl = 'http://104.196.239.135';
                  throw new Error('available api found');
                }      
              })
              .catch(() => this.configureHttp())
          })
          .catch(() => this.configureHttp())
      })
      .catch(() => this.configureHttp());
  }

  configureHttp() {
    if (this.baseUrl[this.baseUrl.length-1] !== '/') {
      this.baseUrl += '/';
    }

    this.http.configure(config => {
      config
        .useStandardConfiguration()
        .withBaseUrl(this.baseUrl);
    });

    this.getData();
  }

  isApiAvailable(url) {
    return this.http.fetch(url)
      .then(result => {
        console.info('API url:', url);
        return true;
      })
      .catch(err => {
        console.error('API not available:', url);
        return false;
      });
  }

  propertyChanged(propertyName, newValue, oldValue) { 
    // for now - do not refresh with every prop changed, rather wait for 'Get Data' to be clicked
    if (["ticker", "till", "since"].indexOf(propertyName) !== -1) {
      //this.getData();
    }
  }

  getData() {
    console.log('getting future', this.ticker, 'prices till', this.till, 'based on data since', this.since);
    this.isLoading(true);
    return this.http.fetch(`GetPriceForDateRange?ticker=${this.ticker}&since=${this.since}&till=${this.till}`)
      .then(response => {
        return response.json();
      })
      .then((prices: any) => {
          this.prices = prices;
          this.estimatedPrice = prices.length > 0 ? prices[prices.length - 1].item2 : "?";
      })
      .then(() => {
        this.drawChart();
        this.isLoading(false);
        console.log('done');
      });
  }

  isLoading(isLoading) {
    $('#getDataButton').prop('disabled', isLoading);

    let $formControls = $('.form-control');

    if (isLoading) {
      $formControls.attr('disabled', 'disabled');
    } else {
      $formControls.removeAttr('disabled');
    }
    
  }

  activate() {
    // run before view rendering
  }

  // the component is attached to the DOM (in document). 
  // If the view-model has an attached callback, it will be invoked at this time.
  // http://aurelia.io/docs.html#/aurelia/framework/1.0.0-beta.1.1.3/doc/article/cheat-sheet
  attached() {
    $("#date-till").datepicker({
      onSelect: (selected, evt) => {
        this.till = selected.toString();
      }
    });
    $("#date-till").datepicker("setDate", new Date(this.till));
    
    $("#date-since").datepicker({
      onSelect: (selected, evt) => {
        this.since = selected.toString();
      }
    });
    $("#date-since").datepicker("setDate", new Date(this.since));

    //this.getData();
  }

  daysFromNow(days) {
    return new Date(Date.now()+days*24*60*60*1000).toISOString().substring(0,10);
  }

  drawChart() {
    let data = this.prices.map(p => {
      return { 
        price: p.item2, 
        date: new Date(p.item1)
      };
    });

    $("#visualisation").empty();
    let vis = d3.select("#visualisation");
    const WIDTH = 600;
    const HEIGHT = 500;
    const MARGINS = {
        top: 20,
        right: 20,
        bottom: 20,
        left: 50
      };
    let xScale = d3.time.scale()
      .range([MARGINS.left, WIDTH - MARGINS.right])
      .domain(d3.extent(data, function(d) { return d.date; }));

    let yScale = d3.scale.linear()
      .range([HEIGHT - MARGINS.top, MARGINS.bottom])
      .domain(d3.extent(data, function(d) { return d.price; }));

    let xAxis = d3.svg.axis()
      .scale(xScale)
      .orient("bottom")
      .innerTickSize(-HEIGHT)
      .outerTickSize(0)
      .ticks(5)
      .tickPadding(10);

    let yAxis = d3.svg.axis()
      .scale(yScale)
      .orient("left")
      .innerTickSize(-WIDTH)
      .outerTickSize(0)
      .tickPadding(10);

    let yGrid = d3.svg.axis()
      .scale(yScale)
      .orient("left")
      .tickSize(-(WIDTH-MARGINS.left-MARGINS.right), 0, 0)
      .tickFormat("")
      .tickPadding(50)
      .ticks(5);
    
    vis.append("svg:g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + (HEIGHT - MARGINS.bottom) + ")")
        .style('fill', '#888888')
        .call(xAxis);

    vis.append("svg:g")
        .attr("class", "y axis")
        .attr("transform", "translate(" + (MARGINS.left) + ",0)")
        .style('fill', '#888888')
        .call(yAxis);

    vis.append("svg:g")
        .attr("class", "y axis")
        .attr("class", "grid")
        .attr("transform", "translate(" + (MARGINS.left) + ",0)")
        .style('fill', '#888888')
        .call(yGrid);

    let lineGen = d3.svg.line()
        .x(function(d) {
            return xScale(d.date);
        })
        .y(function(d) {
            return yScale(d.price);
        })
        .interpolate("none");

    vis.append('svg:path')
        .datum(data)
        .attr("class", "line")
        .attr("d", lineGen)
        .attr('stroke', '#2A9FD6')
        .attr('stroke-width', 1)
        .attr('fill', 'none');
  }
}

export class CurrencyValueConverter {
  toView(value) {
    return value && (Math.round(value * 100) / 100).toFixed(2);
  }
}