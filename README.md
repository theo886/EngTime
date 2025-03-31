# Weekly Percentage Tracker

A simple web application to track weekly time allocation across different projects.

## Features

- Track time allocation by percentage across multiple projects
- Navigate between weeks
- Pin project configurations to carry them forward to future weeks
- Automatic percentage redistribution for unallocated time
- Validation to ensure total equals 100%
- Submit and update timesheet data

## How to Run

### Option 1: Using Node.js (recommended)

1. Make sure you have [Node.js](https://nodejs.org/) installed on your computer
2. Open a terminal/command prompt
3. Navigate to the project directory
4. Run the following command:

```
node server.js
```

5. Open your web browser and navigate to [http://localhost:8080](http://localhost:8080)

### Option 2: Opening the HTML File Directly

You can also simply open the `index.html` file in a web browser. However, this may have limitations with some browsers' security policies.

## Usage

1. Select projects from the dropdown menu
2. Enter percentage allocations for each project
3. Add additional projects using the "Add Project" button
4. Navigate between weeks using the "Prev" and "Next" buttons
5. Use the pin button to maintain the same project configuration when moving to a new week
6. Submit your timesheet when the total equals 100%

## Project Structure

- `Index.html` - The main HTML file
- `index.js` - The application logic
- `server.js` - A simple Node.js server for local development

## Notes

- This is a client-side only application. In a real-world scenario, you would want to add server-side storage.
- The application uses sample project data defined in the JavaScript file. 