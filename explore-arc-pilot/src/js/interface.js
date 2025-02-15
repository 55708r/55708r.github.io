"use strict";


let colors = ["#000", "#0074D9", "#FF4136", "#2ECC40", "#FFDC00", "#AAAAAA", "#F012BE", "#FF851B", "#7FDBFF", "#870C25"]

// let current_file = "";
let current_task = 1;

// so urls like "index.html?file=study_result_1903.json&task=3" will work
let url_params = new URLSearchParams(window.location.search);
if (url_params.get('file')) {
    let current_file = url_params.get('file');
    d3.json("../data/" + current_file).then(render_page);
}
if (url_params.get('task')) {
    current_task = parseInt(url_params.get('task'));
}

let files = [];
let file_idx = 0;

document.getElementById('directoryInput').addEventListener('change', function(event) {
    files = Array.from(event.target.files);
    // console.log(files);
    // enable the next and prev buttons
    document.getElementById('prevFile').disabled = false;
    document.getElementById('nextFile').disabled = false;
    load_file(0);
});

document.getElementById('fileInput').addEventListener('change', function(event) {
    // load the file dirextly
    files = [event.target.files[0]];
    load_file(0);
});

document.getElementById('prevFile').addEventListener('click', function() {
    load_file(file_idx - 1);
});

document.getElementById('nextFile').addEventListener('click', function() {
    load_file(file_idx + 1);
});

function load_file(idx) {
    file_idx = idx;
    current_task = 1;
    document.getElementById('prevFile').disabled = idx == 0;
    document.getElementById('nextFile').disabled = idx == files.length - 1;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        let data = JSON.parse(e.target.result);
        render_page(data);
    };
    reader.readAsText(files[idx]);
}


function render_page(data) {

    // drop last element if its not a task
    if (data[data.length - 1].taskOrder != undefined) {
        data.pop();
    }

    let num_tasks = data.map(d => d.taskPosition).reduce((a, b) => Math.max(a, b), 0);

    let file_info = d3.select("#file_info");
    file_info.selectAll("*").remove();
    file_info.append("h3").text("file: " + files[file_idx].name)

    let task_selector = d3.select("#task_selector");
    task_selector.selectAll("*").remove();
    for (let i = 1; i <= num_tasks; i++) {
        task_selector.append("button").text("Task " + i).on("click", () => {
            current_task = i;
            // set url params
            // window.history.pushState({}, '', '?file=' + current_file + '&task=' + i);
            render_task(data);
        });
    }

    render_task(data);
}

function render_task(data) {
    // console.log(data);

    let prolificId = data[0].prolificId;

    d3.select("#task_title").selectAll("*").remove();
    d3.select("#table_div").selectAll("*").remove();

    let task_data = data.filter(d => d.taskPosition == current_task);
    let task_name = task_data[0].task.split(".")[0]; // remove ".json"
    d3.select("#task_title").append("h1").text("Task " + current_task + ": " + task_name);

    // Load the ground truth data
    let idx = task_name.search(/\d+/); // find first index of a number in the task name
    let category = task_name.slice(0, idx);
    let ground_truth_file = "../../tasks/" + category + "/" + task_name + ".json"
    d3.json(ground_truth_file).then(ground_truth_data_raw => {
        let ground_truth_data = []
        ground_truth_data.push(...ground_truth_data_raw.train);
        ground_truth_data.push(...ground_truth_data_raw.test);
        render_table(task_data, ground_truth_data);
    }).catch(err => {
        d3.select("#table_div").append("p").text("Error loading ground truth data, is local server running?").style("color", "red");
    });
}

function render_table(task_data, ground_truth_data) {
    console.log(task_data);
    // console.log(ground_truth_data);

    let num_tests = task_data.map(d => d.testIndex).reduce((a, b) => Math.max(a, b), 0);
    // console.log(num_tests);

    let max_attempts = task_data.map(d => d.attempt).reduce((a, b) => Math.max(a, b), 0);
    // console.log(max_attempts);

    let table = d3.select("#table_div").append("table");

    let header_row = table.append("tr");
    header_row.append("th").text("Test");
    header_row.append("th").text("Ground Truth Input");
    header_row.append("th").text("Ground Truth Output");
    for (let i = 1; i <= max_attempts; i++) {
        header_row.append("th").text("Attempt " + i);
    }

    for (let i = 1; i <= num_tests; i++) {
        let row = table.append("tr");
        let test_data = task_data.filter(d => d.testIndex == i);
        row.append("td").text("Test " + i);

        // ground truth
        let input_cell = row.append("td");
        draw_grid(ground_truth_data[i-1].input, input_cell);
        let output_cell = row.append("td");
        draw_grid(ground_truth_data[i-1].output, output_cell);
        // light gray background
        input_cell.attr("style", "background-color:rgb(254, 255, 182);");
        output_cell.attr("style", "background-color:rgb(254, 255, 182);");

        // actual attempts
        for (let j = 1; j <= max_attempts; j++) {
            let cell = row.append("td");
            let attempt_data = test_data.filter(d => d.attempt == j);
            if (attempt_data.length > 0) {
                // this attempt exists
                attempt_data = attempt_data[0];
                draw_grid(attempt_data.submission, cell);
                // cell.append("p").text(attempt_data.responseTime);
                cell.on("click", () => {
                    console.log(attempt_data);
                });
                // set row background color to light green if correct
                if (attempt_data.correct) {
                    cell.attr("style", "background-color:rgb(188, 255, 188);");
                }
            }
        }
    }


    
}

function draw_grid(submission, cell) {
    let num_rows = submission.length;
    let num_cols = submission[0].length
    let grid_cell_size = 10;
    let cell_padding = grid_cell_size * 0.02;
    let canvas_width = num_cols * (grid_cell_size + cell_padding);
    let canvas_height = num_rows * (grid_cell_size + cell_padding);

    let svg = cell.append("svg").attr("width", canvas_width).attr("height", canvas_height);
    let background = svg.append("rect").attr("width", canvas_width).attr("height", canvas_height).attr("fill", "#f0f0f0");

    for (let y = 0; y < num_rows; y++) {
        for (let x = 0; x < num_cols; x++) {
            let cell_value = submission[y][x];
            let cell_color = colors[cell_value];
            let cell_x = x * (grid_cell_size + cell_padding);
            let cell_y = y * (grid_cell_size + cell_padding);
            let cell = svg.append("rect").attr("width", grid_cell_size).attr("height", grid_cell_size).attr("x", cell_x).attr("y", cell_y).attr("fill", cell_color);
        }
    }

    // if (correct) {
    //     // console.log("correct");
    //     // add a green rect to the middle
    //     let green_rect = svg.append("rect").attr("width", canvas_width).attr("height", canvas_height).attr("fill", "none")
    //         .attr("stroke", "green")
    //         .attr("stroke-width", 5);
    // }
}


// d3.select("body").append("h1").text("Hello, world!");

