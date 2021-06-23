<h1 align="center">
<a href="http://trudesk.io"><img src="http://trudesk.io/TD_Black.png" width="500" /></a>
<br />Self-Hosted
</h1>
<p align="center">
<a href="https://api.codacy.com/project/badge/Grade/7b3acb53c33b4a40bb32da109bbdd1a9"><img src="https://img.shields.io/codacy/grade/7b3acb53c33b4a40bb32da109bbdd1a9/develop.svg?style=flat-square" /></a>
<a href="https://standarsjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg?style=flat-square" /></a>
<img src="https://img.shields.io/circleci/token/ad7d2d066a75685a15c8e2fd08bd75e53b18fbb7/project/github/polonel/trudesk/develop.svg?style=flat-square" />
<a href="http://hits.dwyl.io/polonel/trudesk"><img src="http://hits.dwyl.io/polonel/trudesk.svg" /></a>
<a href="https://forum.trudesk.io"><img src="https://img.shields.io/discourse/https/forum.trudesk.io/topics.svg?style=flat-square" /></a>
<a title="Crowdin" target="_blank" href="https://crowdin.com/project/trudesk"><img src="https://d322cqt584bo4o.cloudfront.net/trudesk/localized.svg?style=flat-square"></a>
<a href="https://github.com/polonel/trudesk/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-APACHE%202-green.svg?style=flat-square" /></a>
<a href="https://github.com/polonel/trudesk/releases"><img src="https://img.shields.io/github/release/polonel/trudesk.svg?style=flat-square" /></a>
<a href="http://trudesk.io/docs"><img src="https://img.shields.io/badge/documentation-click%20to%20read-blue.svg?style=flat-square" /></a>
<br />
<sub>© 2014-2019, Trudesk, Inc. (<b><a href="https://trudesk.io">@trudesk</a></b>).</sub>
</p>
<br />

### Open Source Help Desk - Simply Organized.
Quickly resolve issues & task with an easy to use solution. Built with one goal in mind, to keep work loads organized and simple. **This is the source for Trudesk Self-Hosted**, the community edition of Trudesk. **For the more comprehensive, cloud-hosted version, please see Trudesk Cloud at <a href="http://trudesk.io">Trudesk.io</a>.**

<p align="center">
    <img src="https://files.trudesk.io/hero-td-right.png" />
</p>

### Online Demo
An online demo is live with fake data at <a href="http://docker.trudesk.io">http://docker.trudesk.io</a>. <br />
<sub>**Note: demo data resets every two hours**<sub>
``` text
Username: demo.user
Password: password
```

#### Deploy Trudesk Anywhere
**Trudesk** is built with <a href="https://nodejs.org">nodejs</a> and <a href="https://mongodb.org">mongodb</a> and can run on any cloud provider, docker, bare-metal, or even a raspberry pi.
Take it for a spin on Ubuntu 16.04 with a one liner - <br />`curl -L -s https://files.trudesk.io/install/install_ubuntu.sh | sudo bash`

### Documentation
Online documentation: [https://docs.trudesk.io/docs](https://docs.trudesk.io/docs)

### Contributing
If you like what you see here, and want to help support the work being done, you could:
+ Report Bugs
+ Request/Implement Features
+ Refactor Codebase
+ Help Write Documentation
+ Translation - Help translate trudesk on [Crowdin](https://crwd.in/trudesk).

### Sponsors
Just a few who have made the project possible.
<br />
<a href="https://www.browserstack.com"><img src="https://files.trudesk.io/browserstack-logo-600x315.png" width="115" /></a>

Trudesk is tested with confidence using [BrowserStack](https://browserstack.com).

### License

    Copyright 2014-2020 Trudesk, Inc.
    
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.apache.org/licenses/LICENSE-2.0
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

### Knowledge

The webpack bundle destination is public/js  
How to check webpack version? `yarn list webpack`  
EWS in node,  the best one https://github.com/gautamsi/ews-javascript-api   

### Attach Debug

```
        {
            "type": "pwa-node",
            "request": "attach",
            "name": "trudesk",
            "skipFiles": [
                "<node_internals>/**"
            ]
        }
```

### To Do
- After applying typesense setting, the service needs reboot
- Package, [pkg](https://github.com/vercel/pkg) or [nexe](https://github.com/nexe/nexe)?
- upgrade to the latest software.
- Review access control, src/permissions, is it enough? do we need casbin as the replacement?
- Review socket.io, src/socketserver.js
- send email when the customers use the portal to create a ticket and comment
- Elastic new javascript client. Currently it is using the legacy one.
- TypeSense: decide the final collection schema
- Knowledge Base, candidates: Raneto, Outline
- License Control/Activation https://github.com/Cryptolens/cryptolens-nodejs
- Deployment on Windows
As a commecial on-premise product, Windows OS might be the favourite choice.

Node.js run as windows service OK, https://github.com/coreybutler/node-windows  
Typesense: Unfortunately it only provides docker version.  
Elastic: OK elasticsearch-service.bat command which will setup Elasticsearch to run as a service.  
MongoDB: OK as a windows service

### Libraries

- [Text to ASCII Art](https://patorjk.com/software/taag/#p=display&f=Big%20Money-nw&t=nanodesk)
- [AngularJS](https://angularjs.org/)
- [Chosen](https://harvesthq.github.io/chosen/)
- [D3](https://d3js.org/)
- [Datatables](https://www.datatables.net/)
- [Easy Pie Chart](https://rendro.github.io/easy-pie-chart/)
- [History.JS](https://github.com/browserstate/history.js/)
- [jQuery](https://jquery.com/)
- [Js-cookie](https://github.com/js-cookie/js-cookie)
- [Lodash](http://lodash.com/)
- [MetricsGraphics.js](http://metricsgraphicsjs.org/)
- [PACE](http://github.hubspot.com/pace/docs/welcome/)
- [Simple Color Picker](https://github.com/tkrotoff/jquery-simplecolorpicker)
- [Selectize.js](http://selectize.github.io/selectize.js/)
- [Snackbar](http://www.polonel.com/snackbar)
- [To Markdown](https://github.com/domchristie/to-markdown)
- [UIKit](http://getuikit.com)
- [Webpack](https://webpack.github.io/)
- [Typesense](https://github.com/typesense/typesense)
- [EWS javascript](https://github.com/gautamsi/ews-javascript-api)
- [Text to SVG/PNG](https://maketext.io/)

### Installation Script

/etc/typesense/typesense-server.ini
Check service status: `systemctl status typesense-server`
Check health: `curl http://localhost:8108/health`

Elastic
 curl -XGET 'http://localhost:9200'
 curl http://localhost:9200/_cluster/health?pretty