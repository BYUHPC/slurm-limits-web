var data;
var original_data;

d3.json("limits.php", function(error, json) {
    if (error) {
        return console.warn(error);
    }
    data = json['rows'];

    if (data.length != 0) {
        // restructuring the data
        // TRES comes in the form of TRES="1=100,2=100" etc. This splits those values into their own attributes.
        for (i=0; i<data.length; ++i) {
            var cpus = data[i]["grp_tres"].match(/(1=[0-9]+)/);
            var mem = data[i]["grp_tres"].match(/(2=[0-9]+)/);
            var cpu_run_mins = data[i]["grp_tres_run_mins"].match(/(1=[0-9]+)/);
            data[i]["grp_cpus"] = cpus? cpus[0].substr(2) : null;
            data[i]["grp_mem"] = mem? mem[0].substr(2) : null;
            data[i]["grp_cpu_run_mins"] = cpu_run_mins? cpu_run_mins[0].substr(2) : null;
        }

        original_data = (JSON.parse(JSON.stringify(data)));

        fill_table("#datatable");
        $('#datatable th:nth-child(3)').append("<a href=\"#\" class=\"tooltip\">*<span><img class=\"callout\" src=\"/images/icons/callout.gif\" />" +
        "Max Wall Time format is &lt;min&gt; or &lt;min&gt;:&lt;sec&gt; or &lt;hr&gt;:&lt;min&gt;:&lt;sec&gt; or &lt;days&gt;-&lt;hr&gt;:&lt;min&gt;:&lt;sec&gt; or &lt;days&gt;-&lt;hr&gt;. The value is recorded in minutes with rounding as needed." +
        "</span></a>");
        $('#datatable th:nth-child(6)').wrapInner('<a href="https://marylou.byu.edu/simulation/grpcpurunmins.php"></a>');
    } else {
        $('#instructions').html("<p>Sorry, either you don&rsquo;t have an account to manage or we can&rsquo;t find any members in your group.</p>")
    }

});

function fill_table(table_container) {
    var table = d3.select(table_container).append("table"),
        thead = table.append("thead"),
        tbody = table.append("tbody");
    var columns = ["User", "Jobs", "Job Wall Time", "CPU Cores", "Max Memory", "CPU Run Minutes"];
    var columns_json = ["user", "grp_submit_jobs", "grp_wall", "grp_cpus", "grp_mem", "grp_cpu_run_mins"];

    thead.append("tr")
        .selectAll("th")
        .data(columns)
        .enter()
        .append("th")
        .text(function(column) { return column; });

    // create a row for each object in the data
    var rows = tbody.selectAll("tr")
        .data(data)
        .enter()
        .append("tr");

    // create a cell in each row for each column
    var cells = rows.selectAll("td")
        .data(function(row) {
            return columns_json.map(function(column) {
                return {column: column, value: row[column]};
            });
        })
        .enter()
        .append("td")
        .text(function(d) { return d.value; })
        .attr("class", function(d) {
            if (d.column == columns_json[0]) {
                return "user";
            } else {
                return "editable " + d.column;
            }
        })
        .attr("contenteditable", function(d) {
            return (d.column != columns_json[0]);
        });
    cells.on("blur", function(d) {
        // get value, user and limit type
        var limit_value = this.innerHTML;
        var parent = this.parentNode;
        var user = parent.getElementsByClassName("user")[0].innerHTML;
        var limit_type = this.className;
        // This uses a RegEx to make sure we get the limit type class rather than any number of other classes that might be attached
        limit_type = limit_type.match(/grp_\w*/)[0];

        if (limit_type == "grp_wall") {
            // make sure the wall time matches the required format: <min> or <min>:<sec> or <hr>:<min>:<sec> or <days>-<hr>:<min>:<sec> or <days>-<hr>
            var matches = limit_value.match(/([\d]+-)?([\d]+(:[\d]+(:[\d]+)?)?)+/);
            limit_value = (matches? matches[0] : null);
        } else {
            limit_value = parseInt(limit_value);
            if (isNaN(limit_value)) {
                limit_value = null;
            }
        }
        this.innerHTML = limit_value;

        for (var i=0; i < data.length; i++) {
            // Update data object
            if (data[i]["user"] === user){
                data[i][limit_type] = limit_value;
                break;
            }
        }

        updateCommand();

    });
}

function updateCommand() {
    var limit_types = ["grp_submit_jobs", "grp_tres", "grp_wall", "grp_cpu_run_mins"];
    var limit_types_slurm = ["GrpJobs", "GrpTRES", "GrpWall", "GrpTRESRunMins"];

    // detect differences between the data and the original data
    var update_string = "";
    for (i=0; i < data.length; i++) {
        for (t=0; t < limit_types.length; t++) {
            if (limit_types[t] == "grp_tres" && (original_data[i]["grp_cpus"] != data[i]["grp_cpus"] || original_data[i]["grp_mem"] != data[i]["grp_mem"])) {
                update_string += 'sacctmgr -i modify user '+data[i]["user"]+' set GrpTRES="';
                var comma = "";
                if (data[i]["grp_cpus"]) {
                    update_string += '1='+data[i]["grp_cpus"];
                    comma = ",";
                }
                if (data[i]["grp_mem"]) {
                    update_string += comma+'2='+data[i]["grp_mem"];
                }
                update_string += '"\n';
            } else if (original_data[i][limit_types[t]] != data[i][limit_types[t]]){
                var limit_value = data[i][limit_types[t]];
                if (limit_value == null) {
                    limit_value = -1;
                }
                // Switch limit type out for its equivalent in limit_types_slurm
                var limit_name = limit_types_slurm[limit_types.indexOf(limit_types[t])];
                if (limit_types[t] == "grp_cpu_run_mins") {
                    update_string += 'sacctmgr -i modify user '+data[i]["user"]+' set '+limit_name+'="1='+limit_value+'"\n';
                } else {
                    update_string += "sacctmgr -i modify user "+data[i]["user"]+" set "+limit_name+"="+limit_value+"\n";
                }
            }
        }
    }
    if (update_string !== "") {
        $("#commands").html(update_string);
    }

}

