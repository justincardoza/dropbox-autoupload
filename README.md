# dropbox-autoupload

This script provides a simple, barebones way of automatically uploading files
to Dropbox on modification. It watches the specified list of files for changes
and initiates an upload when any occur.

I use it to periodically back up the world file for the Terraria server I run
on a Raspberry Pi, which does not have a native Dropbox client.

## Getting Started

First, install the package with `npm i -g dropbox-autoupload`. Then you will
need to obtain an access token to authenticate to Dropbox and create a
configuration file to specify the access token and a list of files to watch.

### Access Token

You can get an access token for your Dropbox account by visiting
https://www.dropbox.com/developers/apps, clicking "Create App," and selecting
"Dropbox API" and the access level you want. I recommend only allowing access
to an app folder rather than full Dropbox access, but that decision is personal
preference. I promise my code won't steal your files. ;-)

Finally, once your app is created in Dropbox, click on it. In the "OAuth 2"
section, under "Generated access token," click the "Generate" button and copy
the token it generates.

### Configuration File

Once you have your access token, you can create your configuration file. This
file is JSON format with only a few fields. Here is an example configuration
file:

```json
{
	"accessToken": "Your_access_token_here",
	"minUpdateInterval": 120,
	"files":
	[
		{"localPath": "index.js", "remotePath": "/index.js"}
	]
}
```

This file can be called whatever you want. `dropbox-autoupload` can take a
configuration filename as a command-line argument, but if no file is specified
that way, it will look for a file called _autoupload.json_ in the current working
directory.

* __accessToken__ is a string containing the Dropbox access token from the
above step.
* __minUpdateInterval__ is an optional number which, if specified, is the
smallest amount of time between uploads of any file. If a file is updated more
frequently, it will not be re-uploaded until at least this much time has passed.
This interval is specified in seconds.
* __files__ is an array of objects specifying the locations of the files to
watch and upload.
	* __localPath__ specifies where each file is located on the local device.
	* __remotePath__ specifies where to upload each file to in Dropbox. This is
	relative to the folder your app has access to.

## Running

Just execute `dropbox-autoupload` from a terminal, specifying the name of
your configuration file if it isn't _autoupload.json_. It will begin watching
the files specified for any changes and uploading them to your Dropbox account
as needed. You should be able to safely end the process at any time, although
the behavior is dependent on the Dropbox SDK if an upload is in progress.

## Known Issues

This will not handle files greater than 150 MB in size. I may add support for
large files in the future.

The authentication mechanism is a little clunky right now and could definitely
use streamlining. Generating an access token and manually putting it in a
configuration file works if you're comfortable with that, but it isn't very
user-friendly.

I have noticed an error that can occur when using an older version of Node.js.
This may be due to partial support for promises. If you run into an error with
a 'catch' or 'finally' and you can't update to the most recent version, let me
know and I can look into a fix.
