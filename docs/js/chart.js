import {removeWarning} from './utils.js';
import rawData from './exported-data.js';

removeWarning('old_browser_warning');


const chartConfig = {
    margins: {
        top: 20,
        right: 20,
        bottom: 30,
        left: 40,
    },
    outerWidth: 1024,
    outerHeight: 768,
};

function initialiseChartElements(rootSelector, config) {
    const height = config.outerHeight - config.margins.top - config.margins.bottom;

    const chartEl = d3.select(rootSelector).append('svg')
        .attr('width', config.outerWidth)
        .attr('height', config.outerHeight)
        .append('g');

    const xAxisGroup = chartEl.append('g')
        .attr('class', 'x-axis-group')
        .attr('transform', `translate(0,${(height - config.margins.bottom)})`);

    const yAxisGroup = chartEl.append('g')
        .attr('class', 'y-axis-group')
        .attr('transform', `translate(${config.margins.left},0)`);

    return {
        chartEl,
        xAxisGroup,
        yAxisGroup,
    };
}

function postProcessData(data) {
    // for this sample, just convert dates to unix epoch seconds and make datastructures immutable
    return Immutable.fromJS(data)
        .map(d => d.set('date', moment(d.get('commit-time'), moment.ISO_8601).unix()))
        .sortBy(d => d.get('date'));
}

function secsToDays(secs) {
    return secs / (60.0 * 60 * 24);
}

function updateChart(config, elements, data) {
    const {
        chartEl,
        xAxisGroup,
        yAxisGroup,
    } = elements;

    const width = config.outerWidth - config.margins.left - config.margins.right;
    const height = config.outerHeight - config.margins.top - config.margins.bottom;

    const minDate = data.map(d => d.get('date')).min();
    const maxDate = data.map(d => d.get('date')).max();
    const maxDuration = secsToDays(data.map(d => d.get('release-delay')).max());

    const yScale = d3.scaleLinear()
        .domain([0, maxDuration])
        .range([height - config.margins.bottom, config.margins.top]);

    const yAxis = d3.axisLeft()
        .scale(yScale)
        .ticks(10, 'd');

    yAxisGroup.call(yAxis);

    const xScale = d3.scaleTime()
        .domain([moment.unix(minDate).toDate(), moment.unix(maxDate).toDate()])
        .range([config.margins.left, width]);

    const xAxis = d3.axisBottom()
        .scale(xScale)
        .ticks(d3.timeWeek.every(1))
        .tickFormat(d3.timeFormat('%d/%m'));

    xAxisGroup.call(xAxis);

    const commits = chartEl.selectAll('.commit')
        .data(data.toArray(), commit => commit.get('id'));

    const newCommits = commits
        .enter()
        .append('circle')
        .attr('class', 'commit')
        .attr('r', 6);

    commits.merge(newCommits)
        .attr('cx', j => xScale(moment.unix(j.get('date')).toDate()))
        .attr('cy', j => yScale(secsToDays(j.get('release-delay'))))
        .append('svg:title')
        .text(n => n.get('msg'));
}

const chartElements = initialiseChartElements('#chart_parent', chartConfig);

const data = postProcessData(rawData);

updateChart(chartConfig, chartElements, data);

// updateChart can be called by event handlers and the like to, y'know, update the chart.
