/**
 * JOURNEY CLASS
 */
class journey {
  /**
   * constructor
   * @param {JSON} deals - from ajax request / response.json
   */
  constructor(deals) {
    /**
     * List of departures
     */
    this.departures = deals
      .map(deal => deal.departure)
      .filter(
        (departure, position, list) => list.indexOf(departure) == position
      )
      .sort();

    /**
     * List of arrivals
     */
    this.arrivals = deals
      .map(deal => deal.arrival)
      .filter((arrival, position, list) => list.indexOf(arrival) == position)
      .sort();

    /**
     * JSON graph with weights added
     */
    this.graph = this.departures.reduce((result, departure) => {
      result[departure] = deals
        .filter(deal => deal.departure === departure)
        .map(deal =>
          Object.assign(deal, {
            weights: {
              duration:
                parseInt(deal.duration.h) * 60 + parseInt(deal.duration.m),
              cost: parseInt(deal.cost) * (1 - parseInt(deal.discount) / 100)
            }
          })
        );
      return result;
    }, {});
  }
  /**
   * getRoute - return dijkstra shortest path
   * @param {string} start - journey start
   * @param {string} end - journey end
   * @param {string} key - duration or cost
   */
  getRoute(start, end, key) {
    /**
     * lowRoute - return the route index with the lowest weight for key
     * @param {array} weights
     * @param {string} key
     * @param {array} calculated
     */
    const lowRoute = (weights, key, calculated) =>
      weights.reduce(
        (lowest, route, idx) =>
          ((lowest === null ||
            route.weights[key] < weights[lowest].weights[key]) &&
            !calculated.includes(route.arrival + route.transport) &&
            (lowest = idx)) ||
          lowest,
        null
      );
    let calculated = [];
    let weights = [
      { arrival: end, weights: { [key]: Infinity } },
      ...this.graph[start]
    ];
    let route = lowRoute(weights, key, calculated);

    while (route) {
      let weight = weights[route];
      let paths = [...this.graph[weights[route].arrival]];
      paths.forEach(path => {
        let newWeight = weight.weights[key] + path.weights[key];
        let foundWeight = weights.findIndex(
          el => el.reference === path.reference
        );
        foundWeight === -1 &&
          weights.push(
            Object.assign(path, {
              weights: {
                [key]: newWeight,
                parent: route
              }
            })
          );
        foundWeight > -1 &&
          weights[foundWeight].weights[key] > newWeight &&
          (weights[foundWeight].weights = {
            [key]: newWeight,
            parent: route
          });
      });

      calculated.push(weights[route].arrival + weights[route].transport);
      route = lowRoute(weights, key, calculated);
    }
    let path = weights.filter(route => route.arrival === end);
    path = [path[lowRoute(path, key, [])]];
    let step = path[0].weights.parent;
    while (step) {
      path.push(weights[step]);
      step = weights[step].weights.parent;
    }
    return path.reverse();
  }

  /**
   * resetGraph - reset graph weights
   */
  resetGraph() {
    this.departures.forEach(deals => {
      this.graph[deals].forEach(
        deal =>
          (deal.weights = {
            duration:
              parseInt(deal.duration.h) * 60 + parseInt(deal.duration.m),
            cost: parseInt(deal.cost) * (1 - parseInt(deal.discount) / 100)
          })
      );
    });
  }
}

/**
 * APP CLASS
 */
class app {
  /**
   * constructor
   * setup UI element list
   * fetch data from server
   */
  constructor() {
    this.el = {
      body: document.body,
      key: document.getElementById("key"),
      start: document.getElementById("start"),
      end: document.getElementById("end"),
      results: document.getElementById("results"),
      totalTime: document.getElementById("totalTime"),
      totalPrice: document.getElementById("totalPrice"),
      currency: document.getElementById("currency")
    };
    fetch("response.json")
      .then(response => response.json())
      .catch(error => alert("Error: " + error.message))
      .then(response => {
        this.currency = response.currency;
        this.routes = new journey(response.deals);
        this.fillSelect(this.el.start, this.routes.departures);
        this.fillSelect(this.el.end, this.routes.arrivals);
        [this.el.key, this.el.start, this.el.end].forEach(elem =>
          elem.addEventListener("change", _ => this.attemptRoute())
        );
        this.el.body.classList.add("live");
      });
  }

  /**
   * makeElements - create html elements from array items
   * @param {array} source - array of data
   * @param {string} tag - html tag to create
   * @param {function} callback - to apply custom attribues and values
   */
  makeElements(source, tag, callback) {
    return source.reduce((result, item) => {
      const element = document.createElement(tag);
      result.appendChild(callback(element, item));
      return result;
    }, document.createElement("div")).innerHTML;
  }

  /**
   * fillSelect - populate a html select with options
   * @param {element} el - target for options
   * @param {array} list - array of values to create
   */
  fillSelect(el, list) {
    const defaultOption =
      "<option disabled selected value> -- choose -- </option>";
    el.innerHTML =
      defaultOption +
      this.makeElements(list, "option", (element, item) => {
        element.setAttribute("value", item);
        element.innerText = item;
        element.setAttribute("id", "start" + item);
        return element;
      });
  }
  
  /**
   * attemptRoute - attempt to calculate and render a route
   *                if all required fields are populated.
   *                and render footer totals.
   *                finally reset the graph weights
   */
  attemptRoute() {
    const key = this.el.key.checked ? "duration" : "cost",
      start =
        this.el.start.selectedIndex > 0
          ? this.el.start.options[this.el.start.selectedIndex].value
          : null,
      end =
        this.el.end.selectedIndex > 0
          ? this.el.end.options[this.el.end.selectedIndex].value
          : null;

    if (start && end) {
      let timeTotal = 0;
      let costTotal = 0;

      this.el.results.innerHTML = this.makeElements(
        this.routes.getRoute(start, end, key),
        "section",
        (element, item) => {
          timeTotal +=
            parseInt(item.duration.h) * 60 + parseInt(item.duration.m);
          costTotal +=
            parseInt(item.cost) * (1 - parseInt(item.discount) / 100);
          Object.keys(item).forEach(key => {
            element.innerHTML += this.makeElements(
              [item],
              "span",
              (el, data) => {
                switch (key) {
                  case "transport":
                    el.classList.add("icon-" + data.transport);
                    break;
                  case "departure":
                    el.innerText = [data.departure, data.arrival].join(" > ");
                    el.classList.add("title");
                    break;
                  case "reference":
                    el.innerText = data.reference;
                    el.classList.add("footer");
                    break;
                  case "cost":
                    el.innerText = [
                      data.cost,
                      this.currency,
                      data.discount === 0 ? "" : "-" + data.discount + "%"
                    ].join(" ");
                    el.classList.add("info");
                    break;
                  case "duration":
                    el.innerText = [data.duration.h, data.duration.m].join("h");
                    el.classList.add("info");
                    break;
                  default:
                    el.classList.add("hidden");
                }
                return el;
              }
            );
          });
          return element;
        }
      );
      this.el.totalTime.innerText =
        Math.floor(timeTotal / 60) + "h" + ("0" + timeTotal % 60).slice(-2);
      this.el.totalPrice.innerText = costTotal;
      this.routes.resetGraph();
    }
  }
}

new app();
