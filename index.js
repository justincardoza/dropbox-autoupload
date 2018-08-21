#!/usr/bin/env node
/*
Monitors specified files for changes and automatically uploads them to Dropbox
when they are modified. You can specify a configuration file as a command line
argument; if not, the script will look for 'autoupload.json' in the current
directory. The configuration file is a JSON file with the following fields:
	accessToken (string, required): The access token for your "app" in Dropbox.
		For more on generating an access token, see the readme file.
	minUpdateInterval (number, optional): The minimum amount of time between
		uploads of any given file in seconds. If a file is modified but the
		remote version is not behind by at least this much, the script will
		wait to upload the new version. This is useful if a file is modified
		frequently but you don't want it to constantly upload every time
		there's a change.
	files (array, required): The files to watch and upload. This is an array
		of objects, each of which has a localPath (which is the path of the
		local file to watch) and a remotePath (which is the location in the
		Dropbox to upload it to).

Copyright 2018 Justin Cardoza

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
*/

require('isomorphic-fetch'); //The Dropbox API won't work without this.
const {Dropbox} = require('dropbox');
const fs = require('fs');

var configFile;

//If a command line argument is supplied, use that. Otherwise, the default
//configuration file is autoupload.json.
if(process.argv.length > 2)
	configFile = process.argv[2];
else
	configFile = 'autoupload.json';

//Read the configuration file.
var config = JSON.parse(fs.readFileSync(configFile));

//If there's no minimum update interval in the configuration file, just upload
//files as soon as they're modified.
if(typeof config.minUpdateInterval !== 'number')
	config.minUpdateInterval = 0;

console.log('Minimum update interval: ' + config.minUpdateInterval + ' s');

//Make sure we have an access token before proceeding.
if(config.accessToken === undefined)
{
	console.log('No access token!');
	process.exit();
}

//Create our Dropbox API object.
var dropbox = new Dropbox({accessToken: config.accessToken});


config.files.forEach(function(file)
{
	//Reads a file from local storage and uploads it through the Dropbox API.
	file.upload = function()
	{
		console.log('Reading ' + this.localPath);
		fs.readFile(this.localPath, (error, data) =>
		{
			if(error)
			{
				this.updating = false;
				console.log('Error reading file ' + this.localPath + ': ' + error);
			}
			else
			{
				let arg = {path: this.remotePath, mode: 'overwrite', contents: data};
				console.log('Uploading ' + this.localPath + ' to ' + this.remotePath);
				
				dropbox.filesUpload(arg).
					then(response => {console.log('Uploaded file ' + this.localPath + ' to ' + this.remotePath)}).
					catch(error => {console.log('Error uploading file ' + this.localPath + ': ' + error)}).
					finally(() => {this.updating = false});
			}
		});
	}
	
	
	//Checks the age of a file given the local stats and the remote metadata.
	file.uploadWhenReady = function(localStats, remoteStats)
	{
		let fileAge = Date.parse(localStats.mtime) - Date.parse(remoteStats.server_modified);
		
		//Date.parse() gives milliseconds, but minUpdateInterval is specified in seconds for convenience.
		if(fileAge > config.minUpdateInterval * 1000)
		{
			console.log('File ' + this.localPath + ' is ' + fileAge + ' ms old, updating now.');
			this.upload();
		}
		else
		{
			let delay = config.minUpdateInterval * 1000 - fileAge;
			console.log('File ' + this.localPath + ' is ' + fileAge + ' ms old, updating in ' + delay + ' ms.');
			setTimeout(() => {this.upload()}, delay);
		}
	}
	
	
	//Gets the local stats and remote metadata for a file, then calls uploadWhenReady()
	//to determine whether to upload the file immediately or wait.
	file.handleFileChanged = function()
	{
		let arg = {path: this.remotePath, include_media_info: false, include_deleted: false, include_has_explicit_shared_members: false};
		
		dropbox.filesGetMetadata(arg).then(metadata =>
		{
			fs.stat(this.localPath, (err, stats) =>
			{
				if(err)
				{
					console.log('Unable to get information on file ' + this.localPath + ': ' + err);
					this.updating = false;
				}
				else
				{
					this.uploadWhenReady(stats, metadata);
				}
			});
		}).catch(error =>
		{
			//Check 'error' to see if it's just the file not existing yet. If so, upload.
			if(error.error.error_summary.includes('not_found'))
				this.upload();
			else
				console.log('Error getting file metadata for ' + this.remotePath + ': ' + error.error.error_summary);
		});
	}
	
	
	//Check the file to see if it needs to be uploaded right away.
	file.handleFileChanged();
	
	//Watch the file for changes.
	file.watcher = fs.watch(file.localPath, 'utf8', function(eventType, filename)
	{
		if(eventType == 'change' && !file.updating)
		{
			file.updating = true;
			file.handleFileChanged();
		}
	});
	
	console.log('Watching file ' + file.localPath);
});
