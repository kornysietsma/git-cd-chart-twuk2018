#!/bin/bash -e

(
  echo -n "export const springRawLog = "
  cat raw_samples/spring-framework.json
  echo ";"
  echo "export const springTitle = \"Spring Framework\";"
  echo 'export const springReleaseTagMatcher = /.*RELEASE/;'
) > docs/js/data/spring_log.js

(
  echo -n "export const verifyFrontendRawLog = "
  cat raw_samples/verify-frontend.json
  echo ";"
  echo "export const verifyFrontendTitle = \"Verify Frontend\";"
  echo 'export const verifyReleaseTagMatcher = /.*release_\d+/;'
) > docs/js/data/verify_frontend_log.js
