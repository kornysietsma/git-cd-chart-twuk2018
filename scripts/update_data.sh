#!/bin/bash -e

declare -a projects=("spring" "verifyFrontend" "verifyHub" "kubernetes" "vscode" "linux")

(
  echo -n "export const springRawLog = "
  cat raw_samples/spring-framework.json
  echo ";"
  echo "export const springTitle = \"Spring Framework\";"
  echo 'export const springReleaseTagMatcher = /.*RELEASE/;'
  echo 'export const springCommitPrefix = "https://github.com/spring-projects/spring-framework/commit/";'
) > docs/js/data/spring_log.js

(
  echo -n "export const verifyFrontendRawLog = "
  cat raw_samples/verify-frontend.json
  echo ";"
  echo "export const verifyFrontendTitle = \"Verify Frontend\";"
  echo 'export const verifyFrontendReleaseTagMatcher = /.*release_\d+/;'
  echo 'export const verifyFrontendCommitPrefix = "https://github.com/alphagov/verify-frontend/commit/";'
) > docs/js/data/verifyFrontend_log.js

(
  echo -n "export const verifyHubRawLog = "
  cat raw_samples/verify-hub.json
  echo ";"
  echo "export const verifyHubTitle = \"Verify Hub\";"
  echo 'export const verifyHubReleaseTagMatcher = /.*release_\d+/;'
  echo 'export const verifyHubCommitPrefix = "https://github.com/alphagov/verify-hub/commit/";'
) > docs/js/data/verifyHub_log.js

(
  echo -n "export const kubernetesRawLog = "
  cat raw_samples/kubernetes.json
  echo ";"
  echo "export const kubernetesTitle = \"Kubernetes\";"
  echo 'export const kubernetesReleaseTagMatcher = "github";'
  echo 'export const kubernetesCommitPrefix = "https://github.com/kubernetes/kubernetes/commit/";'
) > docs/js/data/kubernetes_log.js

(
  echo -n "export const vscodeRawLog = "
  cat raw_samples/vscode.json
  echo ";"
  echo "export const vscodeTitle = \"VScode\";"
  echo 'export const vscodeReleaseTagMatcher = /\d+\.\d+\..*/;'
  echo 'export const vscodeCommitPrefix = "https://github.com/Microsoft/vscode/commit/";'
) > docs/js/data/vscode_log.js

(
  echo -n "export const linuxRawLog = "
  cat raw_samples/linux.json
  echo ";"
  echo "export const linuxTitle = \"linux\";"
  echo 'export const linuxReleaseTagMatcher = /v\d+\.\d+.*/;'
  echo 'export const linuxCommitPrefix = "https://github.com/torvalds/linux/commit/";'
) > docs/js/data/linux_log.js

echo "// auto-generated from scripts/update_data.sh script" > docs/js/data/all.js

for project in "${projects[@]}"; do
  echo "import { ${project}Title, ${project}ReleaseTagMatcher, ${project}CommitPrefix, ${project}RawLog } from './${project}_log.js';" >> docs/js/data/all.js
done

echo "export const allData = {" >> docs/js/data/all.js
for project in "${projects[@]}"; do
  echo "    ${project}: { title:${project}Title, releaseTagMatcher:${project}ReleaseTagMatcher, commitPrefix:${project}CommitPrefix, rawLog:${project}RawLog }," >> docs/js/data/all.js
done
echo "};" >> docs/js/data/all.js
