import {removeWarning} from './utils.js';
import {verifyFrontendRawLog, verifyReleaseTagMatcher} from './data/verify_frontend_log.js';

removeWarning('old_browser_warning');

const chartConfig = {
    margins: {
        top: 20,
        right: 20,
        bottom: 30,
        left: 60,
    },
    outerWidth: 1024,
    outerHeight: 768,
    releaseTagMatcher: verifyReleaseTagMatcher,
    durationSplitAt: 0.9, // proportion of the chart
    durationSplitQuantile: 0.9, // proportion of the data
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

function calculateAuthorData(data) {
    const authorFrequencies = data.countBy(d => d.get('author')).sortBy(v => -v);
    const authorData = authorFrequencies.mapEntries(([author, frequency], ix) => {
        const colour = ix < 20 ? d3.schemeCategory20[ix] : d3.schemeCategory20[19];
        return [author, Immutable.Map({ frequency, colour })];
    });
    return authorData;
}

function releaseDateFromTags(releaseTagMatcher, data) {
    const releaseTag = data.get('tags')
        .filter(tag => tag.get('tags').some(tagName => releaseTagMatcher.test(tagName)))
        .first();
    if (releaseTag) {
        return moment(releaseTag.get('timestamp', moment.ISO_8601)).unix();
    }
    return null;
}

function commitDateInSeconds(commitData) {
    return moment(commitData.get('commit-time'), moment.ISO_8601).unix();
}

function releaseDelay(releaseTagMatcher) {
    return (data) => {
        const releaseDate = releaseDateFromTags(releaseTagMatcher, data);
        if (releaseDate) {
            const commitDate = data.get('date') || commitDateInSeconds(data);
            return releaseDate - commitDate;
        }
        return null;
    };
}

function postProcessData(data, config) {
    // avoid doing too much here - this is effectively a cache, might not be needed.
    const sortedCommits = Immutable.fromJS(data)
        .map(d => d.merge({
            date: commitDateInSeconds(d),
            releaseDelay: releaseDelay(config.releaseTagMatcher)(d),
        }))
        .sortBy(d => d.get('date'));
    const authorData = calculateAuthorData(sortedCommits);

    return { sortedCommits, authorData };
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

function calculateDurationTicks(config, splitDuration, maxDuration) {
    // we want about 10 ticks - depending on the range, these could be
    // minutes, hours, days, weeks, or multiple weeks
    // Assume for now the scale ends at the split - above this is "special" data

    const max = moment.duration(splitDuration, 'seconds');
    let unit;
    if (max < moment.duration(6, 'hours')) {
        unit = 'minutes';
    } else if (max < moment.duration(6, 'days')) {
        unit = 'hours';
    } else if (max < moment.duration(6, 'weeks')) {
        unit = 'days';
    } else {
        unit = 'weeks';
    }

    const maxInUnits = max.as(unit);
    // we want a step that divides this roughly in 10
    const step = Math.max(Math.floor(maxInUnits / 10), 1);
    const range = Immutable.Range(0, maxInUnits, step);
    return range.map(m => moment.duration(m, unit).asSeconds()).toArray();
}

function secondsFormatter(secs) {
    if (secs < 1) {
        return '0';
    }
    const duration = moment.duration(secs, 'seconds');
    if (duration.asDays() > 27) { // moment.js humanize is bad at months
        return `${duration.asDays()} days`;
    }
    return duration.humanize();
}

function updateChart(config, elements, data) {
    const {
        chartEl,
        xAxisGroup,
        yAxisGroup,
    } = elements;
    const {
        sortedCommits,
        authorData,
    } = data;

    const width = config.outerWidth - config.margins.left - config.margins.right;
    const height = config.outerHeight - config.margins.top - config.margins.bottom;

    const minDate = sortedCommits.map(d => d.get('date')).min();
    const maxDate = sortedCommits.map(d => d.get('date')).max();

    const delays = sortedCommits.map(d => d.get('releaseDelay'))
        .filter(d => d !== null)
        .sort()
        .toArray();

    const maxDuration = d3.max(delays);
    const splitDuration = d3.quantile(delays, config.durationSplitQuantile);

    const splitDurationScaleSize = height - config.margins.bottom - config.margins.top;
    const splitDurationScalePixels = splitDurationScaleSize * (1.0 - config.durationSplitAt);
    const yScale = d3.scaleLinear()
        .domain([0, splitDuration, maxDuration])
        .range([
            height - config.margins.bottom,
            config.margins.top + splitDurationScalePixels,
            config.margins.top]);

    const yAxis = d3.axisLeft()
        .scale(yScale)
        .tickValues(calculateDurationTicks(config, splitDuration, maxDuration))
        .tickFormat(secondsFormatter);

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
        .data(sortedCommits.toArray(), commit => commit.get('id'));

    const newCommits = commits
        .enter()
        .append('circle')
        .attr('class', 'commit');

    commits.merge(newCommits)
        .attr('cx', j => xScale(moment.unix(j.get('date')).toDate()))
        .attr('cy', j => yScale(releaseDelay(config.releaseTagMatcher)(j)))
        .attr('r', sizeToRadius)
        .attr('fill', j => {
            const ad = authorData.get(j.get('author'));
            return ad.get('colour');
        })
        .append('svg:title')
        .text(n => n.get('msg'));
}


const chartElements = initialiseChartElements('#chart_parent', chartConfig);

const data = postProcessData(verifyFrontendRawLog, chartConfig);

updateChart(chartConfig, chartElements, data);

// updateChart can be called by event handlers and the like to, y'know, update the chart.
