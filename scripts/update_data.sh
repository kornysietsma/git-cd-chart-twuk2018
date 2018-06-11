#!/bin/bash -e

(
  echo -n "export const springRawLog = "
  cat raw_samples/spring-framework.json
  echo ";"
  echo "export const springTitle = \"Spring Framework\";"
) > docs/js/data/spring_log.js
