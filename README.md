palantir 
========

[![Build Status](https://travis-ci.org/rodrigoi/palantir.svg?branch=master)](https://travis-ci.org/rodrigoi/palantir)

node.js app to monitor and control foscam cameras. It works with FI8910w and has very basic controls. It supports presets.

####configuration

The configuration is divided in two parts. cameras.json and a group of environment variables.

	[
	    {
	      "name": "Sauron",	
	      "config_key": "SAURON",
	      "presets": [
        	{ "name": "couch", "key": 1},
        	{ "name": "kitchen", "key": 2},
        	{ "name": "table", "key": 3},
        	{ "name": "window", "key": 4}
          ]
    	},
    	{
      	  "name": "Saruman",
      	  "config_key" : "SARUMAN",
      	  "presets": [
        	{ "name": "window", "key": 1},
        	{ "name": "center", "key": 2},
        	{ "name": "hallway", "key": 3}
      	  ]
    	}
	]


![image](https://s3.amazonaws.com/rodrigoi/login.png)
![image](https://s3.amazonaws.com/rodrigoi/main.png)
![image](https://s3.amazonaws.com/rodrigoi/responsive.png)

