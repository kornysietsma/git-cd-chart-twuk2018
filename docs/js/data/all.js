// auto-generated from scripts/update_data.sh script
import { springTitle, springReleaseTagMatcher, springCommitPrefix, springRawLog } from './spring_log.js';
import { verifyFrontendTitle, verifyFrontendReleaseTagMatcher, verifyFrontendCommitPrefix, verifyFrontendRawLog } from './verifyFrontend_log.js';
import { verifyHubTitle, verifyHubReleaseTagMatcher, verifyHubCommitPrefix, verifyHubRawLog } from './verifyHub_log.js';
export const allData = {
    spring: { title:springTitle, releaseTagMatcher:springReleaseTagMatcher, commitPrefix:springCommitPrefix, rawLog:springRawLog },
    verifyFrontend: { title:verifyFrontendTitle, releaseTagMatcher:verifyFrontendReleaseTagMatcher, commitPrefix:verifyFrontendCommitPrefix, rawLog:verifyFrontendRawLog },
    verifyHub: { title:verifyHubTitle, releaseTagMatcher:verifyHubReleaseTagMatcher, commitPrefix:verifyHubCommitPrefix, rawLog:verifyHubRawLog },
};
