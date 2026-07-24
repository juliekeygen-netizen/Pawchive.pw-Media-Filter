'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'Start-PawchiveMetadataRunner.ps1'), 'utf8');

assert.match(source, /\[string\]\$LogPath = ''/);
assert.match(source, /\$requestedLogPath = if \(\[string\]::IsNullOrWhiteSpace\(\$LogPath\)\)/);
assert.match(source, /Join-Path \$PSScriptRoot 'PawchiveMetadataRunner\.log'/);
assert.match(source, /\$expanded = Join-Path \$PSScriptRoot \$expanded/);
assert.match(source, /\$statusTitle = \$candidates \| Where-Object/);
assert.match(source, /if \(\$null -eq \$statusTitle\) \{ return '' \}/);
assert.doesNotMatch(source, /Select-Object -First 1\)\[0\]/);

console.log('Pawchive metadata runner startup and default log-path regression checks passed.');
