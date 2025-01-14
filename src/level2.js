/* Interactive visualization of token-level distributional models
Copyright (C) 2021  Thomas Wielfaert and Mariana Montes - QLVL, KU Lueven

The code in this site was inspired by Mike's Bostock brushable Scatterplot matrix
https://observablehq.com/@d3/brushable-scatterplot-matrix

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>. */

function execute(datasets, type, alternatives) {
  const {models} = datasets;
  
  const level = "token";
  // const group = getUrlParameter("group");
  const tokenSelection = listFromLS(level + "selection-" + type);


  // SET UP WORKSPACE ###############################################################################################################################

  d3.select("h1").html("Level 2 (<em>" + type + "</em>)");

  // if (group !== "none") {
  //   d3.select("#groupNumber").html("Group " + group)
  //     .on("mouseover", function () {
  //       d3.select(this).style("color", "red").text("Remove group " + group);
  //     })
  //     .on("mouseout", function () {
  //       d3.select(this).style("color", "black").text("Group " + group);
  //     })
  //     .on("click", function () {
  //       const LSselectionIndex = listFromLS("modelselection-" + type + "-groups");
  //       _.pull(LSselectionIndex, parseInt(group));
  //       localStorage.setItem("modelselection-" + type + "-groups", JSON.stringify(LSselectionIndex));
  //       localStorage.removeItem("modelselection-" + type + "-group" + group);
  //       window.close();
  //     });

  // }
  d3.select("#concordance").style("height", "100px");

  // Set buttons behaviour ##########################################################
  d3.select("#toLevel1").on("click", function () {
    window.open("level1.html" + "?type=" + type, "_self")
  });

  d3.select("#showMatrix").on("click", function () {
    var params = "width=400,height=400,menubar=no,toolbar=no,location=no,status=no";
    window.open("distanceMatrix.html?type=" + type, "distmatrix", params);
  });

  d3.select("#showTable").on("click", function () {
    const winwidth = modelSelection.length*100 + 400
    const params = "width=" + winwidth + ",height=700,menubar=no,toolbar=no,location=no,status=no";
    window.open("cwsTable.html?type=" + type, "freqtable", params);
    // window.open("cwsTable.html?type=" + type + "&group=" + group, "freqtable", params);
  });


  // first info from LocalStorage
  const modelSelection = listFromLS("modelselection-" + type);
  // const modelSelection = listFromLS("modelselection-" + type + "-group" + group);

  if (_.isEmpty(modelSelection)) {
    window.alert("No models found in selection, let's go back to Level 1!");
    window.open("level1.html" + "?type=" + type, "_self");
  } else if (modelSelection.length > 9) {
    window.alert("You have selected too many models, only the first 9 will be used.");
    while (modelSelection.length > 9) {
      modelSelection.pop();
    }
    localStorage.setItem("modelselection-" + type, JSON.stringify(modelSelection));
    // localStorage.setItem("modelselection-" + type + "-group" + group, JSON.stringify(modelSelection));
  }

  // Set up that doesn't depend on the solution(s) ################################################################

  const ncol = 3; // number of columns in the grid
  // const nrow = Math.ceil(modelSelection.length / ncol); // number of rows in the grid
  const width = 250;
  const height = 250;
  const padding = 20;

  //add tooltip (before the svg so it is not on top of it?)
  const tooltip = setTooltip("body");

  const coordinates = offerAlternatives(datasets, alternatives, modelSelection, type);
  const storageSolution = JSON.parse(localStorage.getItem("solution-" + type));
  let chosenSolution = _.isNull(storageSolution) ? alternatives[0] : storageSolution;
  console.log(chosenSolution)
  if (chosenSolution === undefined) chosenSolution = "unique";

  d3.select("#solutions").selectAll("button").on("click", function (d) {
    localStorage.setItem("solution-" + type, JSON.stringify(d));
    d3.select("#solutions").selectAll("button").html(t => {
      return (t === d ? `<b>${t}</b>` : t);
    });
    const technique = d.toLowerCase().search("tsne") > -1 ? `t-SNE, perplexity: ${d.match("[0-9]+")}` : d.toUpperCase();
    d3.select("h4#solutionName").text("Technique: " + technique);
    chosenSolution = d;
    applySolution(chosenSolution);
  });

  // Offer options of solutions if they exist; otherwise, just work with "tokens" ###################################

  // FUNCTIONS ###############################################################################################################

  function applySolution(solution) {
    d3.selectAll("g.miniplot").each((p) => adjustValues(p, solution));
    // svg.selectAll(".brush").remove();
  }
  // update token selection
  function updateTokSelection(tokenSelection) {
    updateSelection(tokenSelection, level, type);
  }


  // Draw the plot based on the right dataset
  const dataset = _.clone(coordinates);
  // _.merge(dataset, datasets["variables"]);
  mergeVariables(dataset, datasets["variables"]);

  const solutionName = JSON.parse(localStorage.getItem("solution-" + type));
  if (!(_.isNull(solutionName))) {
    const technique = solutionName.toLowerCase().search("tsne") > -1 ? "t-SNE, perplexity: " + solutionName.match("[0-9]+") : solutionName.toUpperCase();
    d3.select("h4#solutionName").text("Technique: " + technique);
  }

  // Set up variables

  initVars(dataset, level, type);
  const modelColors = classifyColnames(models)["nominals"];
  let colorModel = varFromLS(models, "color", "model", type);

  updateTokSelection(tokenSelection);

  // clear selection of models
  d3.select("#clearSelect").on("click", () => {
    if (!(brushCell === undefined)) { d3.select(brushCell).call(brush.move, null); }
    clearStorage(tokenSelection, level, type);
  });

  // set up dropdowns #############################################################################
  buildDropdown("modelColour", modelColors,
    valueFunction = d => d,
    textFunction = d => formatVariableName(d))
    .on("click", function () {
      colorModel = updateVar(models, "color", this.value, "model", type);
      colorCircles();
    });

  buildDropdown("colour", nominals).on("click", function () {
    colorvar = updateVar(dataset, "color", this.value, level, type);
    updatePlot();
    updateLegend(colorvar, shapevar, sizevar, padding+10, level, type, dataset);
  });
  buildDropdown("shape",
    nominals.filter(d => d === "Reset" || getValues(dataset, d).length <= 7))
    .on("click", function () {
      shapevar = updateVar(dataset, "shape", this.value, level, type);
      updatePlot();
      updateLegend(colorvar, shapevar, sizevar, padding+10, level, type, dataset);
    });
  buildDropdown("size", numerals).on("click", function () {
    sizevar = updateVar(dataset, "size", this.value, level, type);
    updatePlot();
    updateLegend(colorvar, shapevar, sizevar, padding+10, level, type, dataset);
  });
  buildDropdown("models", modelSelection).on("click", function () {
    window.open("level3.html" + "?type=" + type + "&model=" + this.value);
    // window.open("level3.html" + "?type=" + type + "&group=" + group + "&model=" + this.value);
  });

  // Set up canvas #######################################################################################

  d3.select("#miniPlots").selectAll("div.miniSvg").remove();
  

  // Set up brush
  const brush = d3.brush()
    .extent([[0, 0], [width, height]])
    .on("start", brushstart)
    .on("brush", brushing)
    .on("end", brushed);

  // react to selection of brush/click
  $(document).on("change", 'input[name="selection"]', function () {
    if (d3.select(this).attr("value") === "brush") {
      _.pullAll(tokenSelection, tokenSelection);
      // tokenSelection = [];
      updateTokSelection(tokenSelection);
      d3.selectAll(".miniplot").append("g")
        .attr("transform", `translate(${padding},${padding})`)
        .attr("class", "brush")
        .attr("id", d => d.m)
        .call(brush);
    } else {
      d3.selectAll(".brush").remove();
    }
  });

  // Set up scales (axes) - coordinates multiplied to get some padding in a way
  function setUpScales(m, solution, padding, height, width){
    modelRange = [...getValues(dataset, `${m}-${solution}.x`), ...getValues(dataset, `${m}-${solution}.y`)]
    const range = setRange(modelRange, 1.05);
    
    const x = d3.scaleLinear()
      // .domain(xrange)
      .domain(range)
      .range([padding, width]);
  
    const y = d3.scaleLinear()
      // .domain(yrange)
      .domain(range)
      .range([height, padding]);
  
    // Vertical center
    const xAxis = d3.axisBottom(x)
      .ticks(0)
      // .tickSizeOuter(0);
    const yAxis = d3.axisLeft(y)
      .ticks(0)
      // .tickSizeOuter(0);
    // return({x : x, y : y, xAxis : xAxis, yAxis : yAxis});
    return({x : x, y : y});
  }

  // DRAW PLOT ##############################################################################################################
  d3.select("#miniPlots")
    .selectAll("div.miniSvg")
    .data(modelSelection.map(combine))
    .enter()
    .append("div")
    .attr("class", "miniSvg")
    .append("svg")
    .attr("class", "miniplot")
    .attr("viewBox", d => `0 0 ${width + padding*d.cols} ${height + padding}`)
    .attr("preserveAspectRatio", "xMinYMin meet")
    // .classed("svgPlot", true)
    .append("g")
    .attr("class", "miniplot")
    .attr("model", (d) => d.m)
    .attr("transform", "translate(0,0)")
    .each(plotCell);

  colorCircles();
  updateLegend(colorvar, shapevar, sizevar, padding+10, level, type, dataset);
  updatePlot();



  // FUNCTIONS #################################################################################################################

  function adjustValues(p, solution, tduration = 1500) {
    const newValues = p[solution]
    const c = d3.select(`.miniplot[model='${p.m}']`);
    let x = newValues.x, y = newValues.y;
 
    
    c.select(".xcenter").transition().duration(tduration)
      .attr("x1", x(0)).attr("x2", x(0)); // central x rescaled
    c.select(".ycenter").transition().duration(tduration)
      .attr("y1", y(0)).attr("y2", y(0)); // central y rescaled
    
    c.selectAll("path.present")
      .transition().duration(tduration)
      .attr("transform", (d) => {
        const xcoord = x(d[`${p.m}-${solution}.x`]);
        const ycoord = y(d[`${p.m}-${solution}.y`]);
        return(`translate(${xcoord},${ycoord})`);
      });
  }

  // To combine data of the models in one
  function combine(m, i) {
    const lostTokens = dataset.filter(d => (!exists(d, `${m}-${chosenSolution}`))).length;
    const lostColumns = lostTokens/25 < 1 ? 2 : Math.ceil(lostTokens/25);
    
    const base = {
      m: m,
      j: Math.floor(i / ncol),
      i: i - ncol * Math.floor(i / ncol),
      cols: lostColumns/2
    }
    console.log((lostColumns/2))
    alternatives.forEach(solution => base[solution] = setUpScales(m, solution, padding, height, width));
    return (base);
  }

  // Styling the mini plots

  function mouseoverCell(d) {
    tooltip.transition()
      .duration(20)
      .style("opacity", 1)
      .style("background-color", "white")
      .style("border", "solid")
      .style("border-color", "lightgray");
    console.log(d.m)
    tooltip.html(d.m)
      .style("left", (d3.event.pageX) + "px")		
      .style("top", (d3.event.pageY) + "px");
  }


  function titleCell(miniplot) {
    miniplot.append("text")
      .attr("x", padding * 1.5)
      .attr("y", padding)
      .attr("dy", "-0.5em")
      .attr("font-size", "0.7em")
      .style("cursor", "pointer")
      .text(d => d.m.length > 40 ? d.m.substring(0, 37) + "..." : d.m)
      .on("click", d => window.open(`level3.html?type=${type}&model=${d.m}`));
  }

  function drawFrame(miniplot, p) {
    // Draw frame
    miniplot.append("rect")
      .attr("x", padding)
      .attr("y", padding)
      .attr("width", width - padding)
      .attr("height", height - padding)
      .style("fill", "none")
      .style("stroke", "gray")
      .style("pointer-events", "all")
      .style("stroke-width", 0.6);

    traceCenter(miniplot, x1 = p[chosenSolution].x(0), x2 = p[chosenSolution].x(0), y1 = padding, y2 = height).attr("class", "xcenter");

    traceCenter(miniplot, x1 = padding, x2 = width, y1 = p[chosenSolution].y(0), y2 = p[chosenSolution].y(0)).attr("class", "ycenter");

    // Draw axes
  //   miniplot.append("g")
  //     .attr("class", "axis xAxis")
  //     .attr("transform", "translate(0, " + height + ")")
  //     .call(p[chosenSolution].xAxis);

  //   miniplot.append("g")
  //     .attr("class", "axis yAxis")
  //     .attr("transform", "translate(" + padding + ", " + 0 + ")")
  //     .call(p[chosenSolution].yAxis);
  }

  function colorCircles() {
    d3.selectAll("circle")
      .style("fill", function (d) {
        const m = models.filter(row => row["_model"] === d.m)[0];
        return (code(m, colorModel, color8, "#1f77b4"));
      });
  }

  function numberCell(miniplot) {
    // Show number of model
    miniplot.append("circle")
      .attr("cx", padding)
      .attr("cy", padding)
      .attr("r", padding * 0.6)
      .on("mouseover", mouseoverCell)
      .on("mouseout", function () {
        tooltip.transition().duration(10000).style("opacity", 0);
      });

    miniplot.append("text")
      .attr("x", padding)
      .attr("y", padding)
      .attr("dx", "-0.3em")
      .attr("dy", "0.3em")
      .text((d) => modelSelection.indexOf(d.m) + 1)
      .style("fill", "white")
      .style("font-weight", "bold")
      .style("font-size", "0.8em");
  }

  function mouseoverDot(d) {
    const color = colorvar.values.length <= 8 ? color8 : color12;
    const tooltipColor = code(d, colorvar, color, "#1f77b4")
    // const tooltiptext = typeof(ctxtvar) == "string" ? d[ctxtvar].replace(/<em>/g, "<em style='color:" +tooltipcolor + ";font-weight:bold;'>") : ""
    const ctxt = colnames["all"].filter(d => d.startsWith("_ctxt") && d.endsWith(".raw"))[0];
    const tooltipText1 = "<p><b>" + d["_id"] + "</b></p><p>";
    const tooltipText2 = d[ctxt].replace(/class=["']target["']/g, `style="color:${tooltipColor};font-weight:bold;"`) + "</p>";

    d3.select("#concordance").append("p")
      .attr("class", "text-center p-2 ml-2")
      .style("border", "solid")
      .style("border-color", "gray")
      .style("background-color", "white")
      .style("font-size", "0.8em")
      .html(tooltipText1 + tooltipText2);
  }

  // Styling the dots in the plots

  function styleDot(x, p) {
    const color = colorvar.values.length <= 8 ? color8 : color12;
    d3.select(this)
      .attr("d", d3.symbol()
        .type((d) => code(d, shapevar, shape, d3.symbolCircle)) //set up shape
        .size((d) => code(d, sizevar, size, 50))) // set up size
      .style("stroke", "#a1a09f")
      // .style("stroke-width", 0.5)
      .style("fill", (d) => code(d, colorvar, color, "#1f77b4")) // set up color
      .style("opacity", tokenSelection.length > 0 ? 1 : 0.7)
      .attr("model", d3.select(this.parentNode.parentNode).attr("model"))
      //.attr("token_id", function(d) {return(d["_id"])})
      .classed("lighter", (d) => tokenSelection.length > 0 && tokenSelection.indexOf(d["_id"]) === -1)
      // .classed("lost", function(d) {return(!exists(d, cell)); })
      .on("mouseover", mouseoverDot)
      .on("mouseout", () => d3.select("#concordance").select("p").remove())
      .on("click", function (d) {
        _.pullAll(tokenSelection, tokenSelection);
        listFromLS(level + "selection-" + type).forEach(d => tokenSelection.push(d));
        tokenSelection.indexOf(d["_id"]) === -1 ? tokenSelection.push(d["_id"]) : _.pull(tokenSelection, d["_id"]);
        updateTokSelection(tokenSelection);
      });
  }

  // Updating color, shape and size after every button clicking
  function updatePlot() {
    const color = colorvar.values.length <= 8 ? color8 : color12;
    d3.selectAll(".dot").selectAll("path")
      .style("fill", (d) => code(d, colorvar, color, "#1f77b4"))
      .attr("d", d3.symbol().type((d) => code(d, shapevar, shape, d3.symbolCircle))
        .size((d) => code(d, sizevar, size, 50)));
  }

  // For the brush
  let brushCell;
  function brushstart() {
    _.pullAll(tokenSelection, tokenSelection);
    updateTokSelection(tokenSelection);
    if (!(brushCell === this)) {
      if (!(brushCell === undefined)) { d3.select(brushCell).call(brush.move, null); }
      brushCell = this;
    }
  }

  function brushing(p) {
    const e = d3.event.selection;
    if (!_.isNull(e)) {
      d3.selectAll(".dot").selectAll("path")
        .classed("lighter", function (d) {
          var xc = p[chosenSolution].x(d[`${p.m}-${chosenSolution}.x`]);
          var yc = p[chosenSolution].y(d[`${p.m}-${chosenSolution}.y`]);
          return (xc < e[0][0] + padding || xc > e[1][0] + padding || yc < e[0][1] + padding || yc > e[1][1] + padding || !exists(d, p.m + "-" + chosenSolution));
        });
    }
  }

  function brushed() {
    const e = d3.event.selection;
    if (!_.isNull(e)) {
      d3.selectAll(".dot").selectAll("path")
        .each(function (d) {
          if (!(d3.select(this).classed("lighter")) && tokenSelection.indexOf(d["_id"]) === -1) {
            tokenSelection.push(d["_id"]);
          }
        });
      updateTokSelection(tokenSelection);
    }
  }


  // ACTUALLY PLOTTING STUFF!!
  function plotCell(p) {
    const miniplot = d3.select(this);
    const present = dataset.filter(d => exists(d, `${p.m}-${chosenSolution}`));
    const bin = dataset.filter(d => (!exists(d, `${p.m}-${chosenSolution}`)));
    
    titleCell(miniplot);

    drawFrame(miniplot, p);

    numberCell(miniplot);

    // Draw present tokens
    console.log('2021.11.16')

    miniplot.append("g")
      .attr("transform", "translate(0,0)")
      .attr("class", "dot")
      .selectAll("path")
      .data(present).enter()
      .append("path")
      .attr("class", "graph present")
      .attr("transform", function (d) {
        const xcoord = p[chosenSolution].x(d[`${p.m}-${chosenSolution}.x`]);
        const ycoord = p[chosenSolution].y(d[`${p.m}-${chosenSolution}.y`]);
        return(`translate(${xcoord},${ycoord})`);
      })
      .each(styleDot);

    // Draw lost tokens

    miniplot.append("g")
      .attr("transform", `translate(${width + padding / 4}, ${padding / 2})`)
      .attr("class", "dot")
      .selectAll("path")
      .data(bin).enter()
      .append("path")
      .attr("class", "graph")
      .attr("transform", function (d) {
        var j = bin.indexOf(d);
        var i = Math.floor((j * 10) / width);
        j = j - (i * (width / 10));
        return (`translate(${i * 10}, ${j * 10})`);
      })
      .each(styleDot);
  }

}