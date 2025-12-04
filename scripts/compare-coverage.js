#!/usr/bin/env node

/**
 * Compares test coverage between PR and base branch.
 * Fails if coverage decreases.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function calculateCoverage(coverageData) {
  let totalStatements = 0;
  let coveredStatements = 0;
  let totalBranches = 0;
  let coveredBranches = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalLines = 0;
  let coveredLines = 0;

  for (const file in coverageData) {
    const fileCoverage = coverageData[file];
    
    // Statements
    const s = fileCoverage.s || {};
    for (const key in s) {
      totalStatements++;
      if (s[key] > 0) coveredStatements++;
    }

    // Branches
    const b = fileCoverage.b || {};
    for (const key in b) {
      const branchCounts = b[key];
      totalBranches += branchCounts.length;
      coveredBranches += branchCounts.filter(count => count > 0).length;
    }

    // Functions
    const f = fileCoverage.f || {};
    for (const key in f) {
      totalFunctions++;
      if (f[key] > 0) coveredFunctions++;
    }

    // Lines
    const l = fileCoverage.l || {};
    for (const key in l) {
      totalLines++;
      if (l[key] > 0) coveredLines++;
    }
  }

  return {
    statements: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 100,
    branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 100,
    functions: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 100,
    lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 100,
  };
}

function getOverallCoverage(coverage) {
  // Calculate weighted average
  const total = coverage.statements + coverage.branches + coverage.functions + coverage.lines;
  return total / 4;
}

function main() {
  const prCoveragePath = process.argv[2];
  const baseCoveragePath = process.argv[3];

  if (!prCoveragePath || !baseCoveragePath) {
    console.error('Usage: node compare-coverage.js <pr-coverage.json> <base-coverage.json>');
    process.exit(1);
  }

  let prCoverageData, baseCoverageData;

  try {
    const prContent = readFileSync(prCoveragePath, 'utf-8');
    if (!prContent.trim()) {
      console.error(`Error: PR coverage file is empty: ${prCoveragePath}`);
      process.exit(1);
    }
    prCoverageData = JSON.parse(prContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: PR coverage file not found: ${prCoveragePath}`);
    } else {
      console.error(`Error reading PR coverage file: ${prCoveragePath}`);
      console.error(error.message);
    }
    process.exit(1);
  }

  try {
    const baseContent = readFileSync(baseCoveragePath, 'utf-8');
    if (!baseContent.trim()) {
      console.error(`Error: Base coverage file is empty: ${baseCoveragePath}`);
      process.exit(1);
    }
    baseCoverageData = JSON.parse(baseContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: Base coverage file not found: ${baseCoveragePath}`);
      console.error('This might be the first PR. Coverage comparison will be skipped.');
    } else {
      console.error(`Error reading base coverage file: ${baseCoveragePath}`);
      console.error(error.message);
    }
    process.exit(1);
  }

  const prCoverage = calculateCoverage(prCoverageData);
  const baseCoverage = calculateCoverage(baseCoverageData);

  const prOverall = getOverallCoverage(prCoverage);
  const baseOverall = getOverallCoverage(baseCoverage);

  console.log('\n📊 Coverage Comparison\n');
  console.log('Metric          | Base Branch | PR Branch   | Change');
  console.log('----------------|-------------|-------------|----------');
  console.log(`Statements      | ${baseCoverage.statements.toFixed(2)}%      | ${prCoverage.statements.toFixed(2)}%      | ${(prCoverage.statements - baseCoverage.statements).toFixed(2)}%`);
  console.log(`Branches        | ${baseCoverage.branches.toFixed(2)}%      | ${prCoverage.branches.toFixed(2)}%      | ${(prCoverage.branches - baseCoverage.branches).toFixed(2)}%`);
  console.log(`Functions       | ${baseCoverage.functions.toFixed(2)}%      | ${prCoverage.functions.toFixed(2)}%      | ${(prCoverage.functions - baseCoverage.functions).toFixed(2)}%`);
  console.log(`Lines           | ${baseCoverage.lines.toFixed(2)}%      | ${prCoverage.lines.toFixed(2)}%      | ${(prCoverage.lines - baseCoverage.lines).toFixed(2)}%`);
  console.log('----------------|-------------|-------------|----------');
  console.log(`Overall         | ${baseOverall.toFixed(2)}%      | ${prOverall.toFixed(2)}%      | ${(prOverall - baseOverall).toFixed(2)}%`);
  console.log('');

  if (prOverall < baseOverall) {
    const decrease = baseOverall - prOverall;
    console.error(`❌ Coverage decreased by ${decrease.toFixed(2)}%`);
    console.error('Coverage must not decrease. Please add tests to maintain or improve coverage.');
    process.exit(1);
  } else if (prOverall > baseOverall) {
    const increase = prOverall - baseOverall;
    console.log(`✅ Coverage increased by ${increase.toFixed(2)}%`);
  } else {
    console.log('✅ Coverage maintained');
  }

  // Also check individual metrics - fail if any critical metric decreases significantly
  const significantDecrease = 0.5; // 0.5% threshold
  let hasSignificantDecrease = false;

  if (prCoverage.statements < baseCoverage.statements - significantDecrease) {
    console.error(`❌ Statement coverage decreased by ${(baseCoverage.statements - prCoverage.statements).toFixed(2)}%`);
    hasSignificantDecrease = true;
  }
  if (prCoverage.branches < baseCoverage.branches - significantDecrease) {
    console.error(`❌ Branch coverage decreased by ${(baseCoverage.branches - prCoverage.branches).toFixed(2)}%`);
    hasSignificantDecrease = true;
  }
  if (prCoverage.functions < baseCoverage.functions - significantDecrease) {
    console.error(`❌ Function coverage decreased by ${(baseCoverage.functions - prCoverage.functions).toFixed(2)}%`);
    hasSignificantDecrease = true;
  }
  if (prCoverage.lines < baseCoverage.lines - significantDecrease) {
    console.error(`❌ Line coverage decreased by ${(baseCoverage.lines - prCoverage.lines).toFixed(2)}%`);
    hasSignificantDecrease = true;
  }

  if (hasSignificantDecrease) {
    console.error('\nCoverage must not decrease. Please add tests to maintain or improve coverage.');
    process.exit(1);
  }
}

main();

