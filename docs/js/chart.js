import { removeWarning } from './utils.js';
import { verifyFrontendRawLog, verifyReleaseTagMatcher } from './data/verify_frontend_log.js';

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
    releaseTagMatcher: verifyReleaseTagMatcher,
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

function releaseTime(releaseTagMatcher, data) {
    const releaseTag = data.get('tags')
   .filter(tag => tag.get('tags').some(tagName => releaseTagMatcher.test(tagName)))
   .first();
    if (releaseTag) {
        return moment(releaseTag.get('timestamp', moment.ISO_8601)).unix();
    }
    return null;
}

function releaseDelay(releaseTagMatcher) {
    return (data) => {
        const rt = releaseTime(releaseTagMatcher, data);
        if (rt) {
            return rt - data.get('date');
        }
        return null;
    };
}

function sizeToRadius(data) {
    const size = data.get('diffs').valueSeq().reduce((m, v) => m + v);
    if (size === undefined) {
        return 0;
    }
    if (size <= 4) {
        return 2;
    }
    return Math.sqrt(size);
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
    const maxDuration = secsToDays(data.map(releaseDelay(config.releaseTagMatcher)).max());

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
        .attr('class', 'commit');

    commits.merge(newCommits)
        .attr('cx', j => xScale(moment.unix(j.get('date')).toDate()))
        .attr('cy', j => yScale(secsToDays(releaseDelay(config.releaseTagMatcher)(j))))
        .attr('r', sizeToRadius)
        .append('svg:title')
        .text(n => n.get('msg'));
}

const chartElements = initialiseChartElements('#chart_parent', chartConfig);

const data = postProcessData(verifyFrontendRawLog);

updateChart(chartConfig, chartElements, data);

// updateChart can be called by event handlers and the like to, y'know, update the chart.
