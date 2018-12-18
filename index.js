/*
    Read bugs for the current release cycle (defined in branchDate) 
    for Firefox components in CSV format.

    Create a report of triage status by triage owner for all 
    unresolved bugs.
*/

// modules
const got = require('got');
const parse = require('csv-parse');
const asTable = require('as-table').configure ({ right: true });

const max = 10000; // max records we can read from Bugzilla

var branchDate = '2018-09-04'; // YYYY-MM-DD of first nightly of current release
var last = 0; // last bug id we saw
var count = 0; // number of records we got in a GET
var done = false;

var URLbase = `https://bugzilla.mozilla.org/buglist.cgi?columnlist=triage_owner%2Cproduct%2Ccomponent%2Cbug_status%2Cresolution%2Cpriority%2Ckeywords%2Creporter%2Cassigned_to%2Cshort_desc%2Cchangeddate&ctype=csv&human=1&chfield=%5BBug%20creation%5D&chfieldfrom=${branchDate}&chfieldto=Now&email1=intermittent-bug-filer%40mozilla.bugs&emailreporter1=1&emailtype1=notequals&f1=bug_id&limit=0&o1=greaterthan&product=DevTools&product=External%20Software%20Affecting%20Firefox&product=Firefox&product=Firefox%20Build%20System&product=Firefox%20for%20Android&product=Firefox%20for%20Echo%20Show&product=Firefox%20for%20FireTV&product=Firefox%20for%20iOS&product=Focus&product=Focus-iOS&product=NSPR&product=NSS&product=Toolkit&product=WebExtensions&query_format=advanced&v1=`;

// create array to store data read
var data = [];

// create data structure to hold results
var report = {};

function get_parser() {
    return parse({
        delimiter: ',', 
        columns: true
    })
    .on('readable', function() {
        let record;
        while (record = parser.read()) {

            let triage_owner = record['Triage Owner'];
            data.push(record);
            count++;

            if (record.Resolution.trim() === '---') {
                // first update the triage owner totals
                if (report[triage_owner]) {
                    report[triage_owner].total ++;
                } else {
                    report[triage_owner] = { 
                        total: 1,
                        '--' : 0,
                        p1: 0,
                        p2: 0,
                        p3: 0,
                        p4: 0,
                        p5: 0
                    };
                }

                // then the per-owner triage totals
                report[triage_owner][record.Priority.trim().toLowerCase()] ++;

                if(record["Bug ID"] > last) {
                    last = record["Bug ID"];
                }
            }
        }
    })
    .on('error', function(err) {
        console.error(err.message);
    })
    .on('end', function() {
        console.info('got', count, 'records');
        console.info('last id', last);
        // check for boundary
        if (count < max) {
            done = true;
            console.log('read last batch');
            // write data, first turning the report object into an array of objects
            // then sorting by the number of untriaged bugs, descending
            console.info(asTable(Object.keys(report).map(triage_owner => {
                return {
                    'Triage Owner': triage_owner,
                    'Untriaged': report[triage_owner]['--'],
                    'P1': report[triage_owner].p1,
                    'P2': report[triage_owner].p2,
                    'P3': report[triage_owner].p3,
                    'P4': report[triage_owner].p4,
                    'P5': report[triage_owner].p5,
                    'Total': report[triage_owner].total
                };
            }).sort((a, b) => { return (b.Untriaged - a.Untriaged);})));
        } else {
            start_stream(last);
        }

    });
}

function start_stream(last) {
    var URL = URLbase + last;
    count = 0;
    console.info('fetching', URL);
    parser = get_parser();
    bug_stream = got.stream(URL).pipe(parser);
}

var bug_stream, parser;

start_stream(last);