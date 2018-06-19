import {removeWarning} from './utils.js';
import {verifyFrontendRawLog, verifyReleaseTagMatcher, verifyCommitPrefix} from './data/verify_frontend_log.js';

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
    commitPrefix: verifyCommitPrefix,
    durationSplitAt: 0.95, // proportion of the chart
    durationSplitQuantile: 0.99, // proportion of the data
    chartStartDate: null, // populated later
    chartEndDate: null, // populated later
    selectedCommit: null,
    selectedCommitEl: null,
};

function setInitialDates(config, earliestDate, latestDate) {
    const oneYearAgo = moment.unix(latestDate).subtract(1, 'years').unix();
    const defaultStartDate = Math.max(earliestDate, oneYearAgo);
    config.chartStartDate = defaultStartDate;
    config.chartEndDate = latestDate;
}

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

    const earliestDateText = moment.unix(config.chartStartDate).format('YYYY-MM-DD');
    const fromDateHtml = `<fieldset class="date-picker"><span>From date:</span><input id="fromDate" type="date" value="${earliestDateText}">`;
    const latestDateText = moment.unix(config.chartEndDate).format('YYYY-MM-DD');
    const toDateHtml = `<fieldset class="date-picker"><span>To date:</span><input id="toDate" type="date" value="${latestDateText}">`;

    const controlsEl = document.getElementById('controls');
    controlsEl.insertAdjacentHTML('beforeend', fromDateHtml);
    controlsEl.insertAdjacentHTML('beforeend', toDateHtml);
    const inspectorEl = document.getElementById('inspector');
    inspectorEl.innerHTML = '<p>Select a commit for more details</p>';

    return {
        chartEl,
        xAxisGroup,
        yAxisGroup,
        fromDateEl: document.getElementById('fromDate'),
        toDateEl: document.getElementById('toDate'),
        inspectorEl,
    };
}

function initialiseGlobalEvents(config, chartElements, onChangeFn) {
    chartElements.fromDateEl.addEventListener('change', () => {
        const newDate = chartElements.fromDateEl.value;
        const parsedDate = moment(newDate, 'YYYY-MM-DD');
        if (parsedDate.isValid() && parsedDate.unix() < config.chartEndDate) {
            config.chartStartDate = parsedDate.unix();
            onChangeFn();
        } else {
            console.log('invalid start date:', newDate);
        }
    });
    chartElements.toDateEl.addEventListener('change', () => {
        const newDate = chartElements.toDateEl.value;
        const parsedDate = moment(newDate, 'YYYY-MM-DD');
        if (parsedDate.isValid() && parsedDate.unix() > config.chartStartDate) {
            config.chartEndDate = parsedDate.unix();
            onChangeFn();
        } else {
            console.log('invalid end date:', newDate);
        }
    });
}

function calculateAuthorData(data) {
    const authorFrequencies = data.countBy(d => d.get('author')).sortBy(v => -v);
    const authorData = authorFrequencies.mapEntries(([author, frequency], ix) => {
        const colour = ix < 20 ? d3.schemeCategory20[ix] : d3.schemeCategory20[19];
        return [author, Immutable.Map({ frequency, colour })];
    });
    return authorData;
}

function releaseInfoFromTags(releaseTagMatcher, data) {
    const releaseTag = data.get('tags')
        .filter(tag => tag.get('tags').some(tagName => releaseTagMatcher.test(tagName)))
        .first();
    if (releaseTag) {
        return {
            releaseDate: moment(releaseTag.get('timestamp', moment.ISO_8601)).unix(),
            releaseTag: releaseTag.get('tags').filter(tagName => releaseTagMatcher.test(tagName)).first(),
        };
    }
    return { releaseDate: null, releaseTag: null };
}

function commitDateInSeconds(commitData) {
    return moment(commitData.get('commit-time'), moment.ISO_8601).unix();
}

function releaseDelay(releaseTagMatcher) {
    return (data) => {
        const { releaseDate } = releaseInfoFromTags(releaseTagMatcher, data);
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

    const globalEarliestDate = sortedCommits.first().get('date');
    const globalLatestDate = sortedCommits.last().get('date');

    return { sortedCommits, authorData, globalEarliestDate, globalLatestDate };
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
    return range.map(m => moment.duration(m, unit).asSeconds()).toList().push(maxDuration).toArray();
}

function secondsFormatter(maxDuration) {
    return (secs) => {
        if (secs < 1) {
            return '0';
        }
        if (secs >= maxDuration) {
            return 'outliers';
        }
        const duration = moment.duration(secs, 'seconds');
        if (duration.asMinutes() < 180) {
            return `${duration.asMinutes()} m`;
        }
        if (duration.asHours() < 72) {
            return `${duration.asHours()} h`;
        }
        if (duration.asDays() < 7) {
            // format as days and hours
            const h = duration.hours(); // not "asHours" - this should return 0 to 23
            const d = Math.floor(duration.asDays());
            if (h === 0) {
                return `${d} d`;
            }
            return `${d} d ${h} h`;
        }
        return `${Math.floor(duration.asDays())} d`;
    };
}

function sanitise(str) {
    return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function commitAsHtml(config, commit) {
    const msg = commit.get('msg');
    const author = commit.get('author');
    const authorTime = commit.get('author-time');
    const committer = commit.get('committer');
    const commitTime = commit.get('commit-time');
    const sha = commit.get('id');
    const commitHtml = config.commitPrefix !== null
        ? `<a href="${config.commitPrefix + sha}" target="_blank">${sha}</a>`
        : sha;
    const { releaseDate, releaseTag } = releaseInfoFromTags(config.releaseTagMatcher, commit);

    const tagHtmlInner = commit.get('tags').map(tag => `<li>${tag.get('tags').join(', ')} at ${tag.get('timestamp')}</li>`).join('\n');

    const releaseDelayDuration = releaseDate == null ? null : moment.duration(releaseDate - commit.get('date'), 'seconds');
    const releaseInfo = releaseDate == null
        ? '(never released)'
        : `Released: ${releaseTag} at ${moment.unix(releaseDate).format()}<br/>Release delay of roughly ${releaseDelayDuration.humanize()}`;

    return `<p>${commitHtml}<br/>` +
        `${sanitise(msg)}<br/>` +
        `Author: ${author} at ${authorTime}<br/>` +
        `Committer: ${committer} at ${commitTime}<br/>` +
        `${releaseInfo}</p>` +
        `<ul>${tagHtmlInner}</ul>`;
}

function unSelectCommit(el, inspectorEl) {
    if (el) {
        d3.select(el).style('stroke', '#fff400').style('stroke-width', '0');
    }
    inspectorEl.innerHTML = '<p>Nothing selected</p>';
}

function selectCommit(el, inspectorEl, commit, config) {
    d3.select(el).style('stroke', '#fff400').style('stroke-width', '2');
    inspectorEl.innerHTML = commitAsHtml(config, commit);
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

    const selectedCommits = sortedCommits.filter(commit =>
        commit.get('date') >= config.chartStartDate && commit.get('date') <= config.chartEndDate);

    const minDate = selectedCommits.map(d => d.get('date')).min();
    const maxDate = selectedCommits.map(d => d.get('date')).max();

    const delays = selectedCommits.map(d => d.get('releaseDelay'))
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
        .tickFormat(secondsFormatter(maxDuration));

    yAxisGroup.call(yAxis);

    const xScale = d3.scaleTime()
        .domain([moment.unix(minDate).toDate(), moment.unix(maxDate).toDate()])
        .range([config.margins.left, width]);

    const xAxis = d3.axisBottom()
        .scale(xScale)
        .ticks(d3.timeMonth.every(1))
        .tickFormat(d3.timeFormat('%m/%y'));

    xAxisGroup.call(xAxis);

    const commits = chartEl.selectAll('.commit')
        .data(selectedCommits.toArray(), commit => commit.get('id'));

    const newCommits = commits
        .enter()
        .append('circle')
        .attr('class', 'commit');

    const selectCommitCallback = (node, i, nodes) => {
        if (config.selectedCommitEl) {
            unSelectCommit(config.selectedCommitEl, elements.inspectorEl);
        }
        config.selectedCommitEl = nodes[i];
        selectCommit(config.selectedCommitEl, elements.inspectorEl, node, config);
    };

    commits.merge(newCommits)
        .attr('cx', j => xScale(moment.unix(j.get('date')).toDate()))
        .attr('cy', j => yScale(releaseDelay(config.releaseTagMatcher)(j)))
        .attr('r', sizeToRadius)
        .attr('fill', j => {
            const ad = authorData.get(j.get('author'));
            return ad.get('colour');
        })
        .on('click', selectCommitCallback)
        .append('svg:title')
        .text(n => n.get('msg'));

    commits
        .exit()
        .remove();
}

const data = postProcessData(verifyFrontendRawLog, chartConfig);

setInitialDates(chartConfig, data.globalEarliestDate, data.globalLatestDate);

const chartElements = initialiseChartElements('#chart_parent', chartConfig);

// onChange should be called by event handlers and the like to, y'know, update the chart.
function onChange() {
    updateChart(chartConfig, chartElements, data);
}

onChange();

initialiseGlobalEvents(chartConfig, chartElements, onChange);

