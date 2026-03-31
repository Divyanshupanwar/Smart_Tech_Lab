const fs = require("fs");
const path = require("path");
const mongoose = require("./src/node_modules/mongoose");
const bcrypt = require("./src/node_modules/bcrypt");
require("./src/node_modules/dotenv").config({ path: path.join(__dirname, ".env") });

const Problem = require("./src/models/problem");
const User = require("./src/models/user");
const SolutionVideo = require("./src/models/solutionVideo");
const { Assignment } = require("./src/models/assignment");

const assignmentDir = path.join(__dirname, "Frontend", "frontend", "public", "assignments");

const escapePdfText = (text) =>
  text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function createSimplePdf(title, lines) {
  const contentLines = [
    "BT",
    "/F1 20 Tf",
    "50 790 Td",
    `(${escapePdfText(title)}) Tj`,
    "/F1 12 Tf",
  ];

  lines.forEach((line, index) => {
    if (index === 0) {
      contentLines.push("0 -32 Td");
    } else {
      contentLines.push("0 -18 Td");
    }
    contentLines.push(`(${escapePdfText(line)}) Tj`);
  });

  contentLines.push("ET");
  const stream = contentLines.join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function ensurePdf(filename, title, lines) {
  fs.mkdirSync(assignmentDir, { recursive: true });
  const filePath = path.join(assignmentDir, filename);
  fs.writeFileSync(filePath, createSimplePdf(title, lines), "utf8");
  return `/assignments/${filename}`;
}

async function ensureSeedUser() {
  let user = await User.findOne({ emailID: "seed.admin@smarttechlab.local" });
  if (user) {
    return user;
  }

  const password = await bcrypt.hash("SeedAdmin1!", 10);
  user = await User.create({
    firstName: "Seed",
    lastName: "Admin",
    emailID: "seed.admin@smarttechlab.local",
    password,
    role: "admin",
    age: 25,
  });

  return user;
}

async function upsertProblem(seedUser, definition) {
  const existing = await Problem.findOne({ title: definition.title });
  const payload = {
    ...definition,
    problemCreator: seedUser._id,
  };

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }

  return Problem.create(payload);
}

async function upsertYoutubeVideo(seedUser, problemId, youtubeUrl) {
  const existing = await SolutionVideo.findOne({ problemId, provider: "youtube" });
  const payload = {
    problemId,
    userId: seedUser._id,
    youtubeUrl,
    provider: "youtube",
    cloudinaryPublicId: `youtube:${problemId}`,
    secureUrl: "",
    thumbnailUrl: "",
    duration: 0,
  };

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }

  return SolutionVideo.create(payload);
}

async function upsertAssignment(seedUser, definition) {
  const existing = await Assignment.findOne({ title: definition.title });
  const payload = {
    ...definition,
    createdBy: seedUser._id,
  };

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }

  return Assignment.create(payload);
}

async function main() {
  await mongoose.connect(process.env.DB_CONNECT_STRING);

  const seedUser = await ensureSeedUser();

  const pdfs = {
    daa: ensurePdf("daa-greedy-assignment.pdf", "DAA Greedy Assignment", [
      "1. Solve the Activity Selection Scheduler problem.",
      "2. Explain why the greedy choice property works here.",
      "3. Compare greedy vs dynamic programming for interval-style tasks.",
    ]),
    oops: ensurePdf("oops-gradebook-assignment.pdf", "OOPs Gradebook Assignment", [
      "1. Build a StudentGradebook class with addScore and average methods.",
      "2. Use encapsulation for internal score storage.",
      "3. Write a short note on class design tradeoffs.",
    ]),
    cprog: ensurePdf("c-pointers-assignment.pdf", "C Programming Pointer Assignment", [
      "1. Implement pointer-based input processing.",
      "2. Swap values and compute sums using pointer arithmetic.",
      "3. Explain memory safety checks you added.",
    ]),
  };

  const problems = [
    {
      title: "Activity Selection Scheduler",
      description:
        "Given N activities with start and end times, print the maximum number of non-overlapping activities that can be selected.\n\nInput:\nFirst line contains N.\nNext N lines contain two integers start and end.\n\nOutput:\nPrint the maximum count.",
      difficulty: "easy",
      subject: "DAA",
      tags: "Greedy",
      visibleTestCases: [
        { input: "6\n1 3\n2 5\n4 7\n1 8\n5 9\n8 10", output: "3", explanation: "Pick (1,3), (4,7), (8,10)." },
        { input: "3\n1 2\n2 3\n3 4", output: "3", explanation: "Each activity starts when the previous one ends." },
      ],
      hiddenTestCases: [
        { input: "4\n1 4\n2 3\n3 5\n6 7", output: "3" },
        { input: "5\n1 10\n2 3\n3 4\n4 5\n5 6", output: "4" },
      ],
      startCode: [
        { language: "C++", initialCode: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    vector<pair<int,int>> activities(n);\n    for (int i = 0; i < n; i++) cin >> activities[i].first >> activities[i].second;\n    // write your code here\n    return 0;\n}\n" },
        { language: "Java", initialCode: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[][] activities = new int[n][2];\n        for (int i = 0; i < n; i++) {\n            activities[i][0] = sc.nextInt();\n            activities[i][1] = sc.nextInt();\n        }\n        // write your code here\n    }\n}\n" },
        { language: "JavaScript", initialCode: "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nlet idx = 0;\nconst n = input[idx++];\nconst activities = [];\nfor (let i = 0; i < n; i++) {\n  activities.push([input[idx++], input[idx++]]);\n}\n// write your code here\n" },
      ],
      referenceSolution: [
        { language: "C++", completeCode: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    vector<pair<int,int>> activities(n);\n    for (int i = 0; i < n; i++) cin >> activities[i].first >> activities[i].second;\n    sort(activities.begin(), activities.end(), [](auto &a, auto &b) {\n        if (a.second == b.second) return a.first < b.first;\n        return a.second < b.second;\n    });\n    int count = 0;\n    int lastEnd = INT_MIN;\n    for (auto &activity : activities) {\n        if (activity.first >= lastEnd) {\n            count++;\n            lastEnd = activity.second;\n        }\n    }\n    cout << count;\n    return 0;\n}\n" },
        { language: "Java", completeCode: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[][] activities = new int[n][2];\n        for (int i = 0; i < n; i++) {\n            activities[i][0] = sc.nextInt();\n            activities[i][1] = sc.nextInt();\n        }\n        Arrays.sort(activities, (a, b) -> a[1] == b[1] ? Integer.compare(a[0], b[0]) : Integer.compare(a[1], b[1]));\n        int count = 0;\n        int lastEnd = Integer.MIN_VALUE;\n        for (int[] activity : activities) {\n            if (activity[0] >= lastEnd) {\n                count++;\n                lastEnd = activity[1];\n            }\n        }\n        System.out.print(count);\n    }\n}\n" },
        { language: "JavaScript", completeCode: "const fs = require('fs');\nconst nums = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nlet idx = 0;\nconst n = nums[idx++];\nconst activities = [];\nfor (let i = 0; i < n; i++) activities.push([nums[idx++], nums[idx++]]);\nactivities.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));\nlet count = 0;\nlet lastEnd = Number.NEGATIVE_INFINITY;\nfor (const [start, end] of activities) {\n  if (start >= lastEnd) {\n    count++;\n    lastEnd = end;\n  }\n}\nconsole.log(count.toString());\n" },
      ],
    },
    {
      title: "Student Gradebook Class",
      description:
        "Create a gradebook program that reads a student name and three marks, stores them in a class/object, and prints the average with two decimal places.\n\nInput:\nName on the first line.\nThree integers on the second line.\n\nOutput:\nPrint: <name> <average>",
      difficulty: "easy",
      subject: "OOPs",
      tags: "Classes",
      visibleTestCases: [
        { input: "Aarav\n80 90 100", output: "Aarav 90.00", explanation: "Average of 80, 90, 100 is 90.00." },
        { input: "Mia\n60 70 80", output: "Mia 70.00", explanation: "Average is 70.00." },
      ],
      hiddenTestCases: [
        { input: "Riya\n75 75 75", output: "Riya 75.00" },
        { input: "Sam\n100 98 96", output: "Sam 98.00" },
      ],
      startCode: [
        { language: "C++", initialCode: "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Gradebook {\n  // write your members here\n};\n\nint main() {\n  string name;\n  getline(cin, name);\n  int a, b, c;\n  cin >> a >> b >> c;\n  // write your code here\n  return 0;\n}\n" },
        { language: "Java", initialCode: "import java.util.*;\n\nclass Gradebook {\n    // write your members here\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String name = sc.nextLine();\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        int c = sc.nextInt();\n        // write your code here\n    }\n}\n" },
        { language: "JavaScript", initialCode: "const fs = require('fs');\nconst lines = fs.readFileSync(0, 'utf8').trim().split(/\\n/);\nconst name = lines[0].trim();\nconst [a, b, c] = lines[1].trim().split(/\\s+/).map(Number);\nclass Gradebook {\n  // write your members here\n}\n// write your code here\n" },
      ],
      referenceSolution: [
        { language: "C++", completeCode: "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Gradebook {\n    string name;\n    int a, b, c;\npublic:\n    Gradebook(string n, int x, int y, int z) : name(n), a(x), b(y), c(z) {}\n    double average() const { return (a + b + c) / 3.0; }\n    string studentName() const { return name; }\n};\n\nint main() {\n    string name;\n    getline(cin, name);\n    int a, b, c;\n    cin >> a >> b >> c;\n    Gradebook gb(name, a, b, c);\n    cout << gb.studentName() << ' ' << fixed << setprecision(2) << gb.average();\n    return 0;\n}\n" },
        { language: "Java", completeCode: "import java.util.*;\n\nclass Gradebook {\n    private final String name;\n    private final int a;\n    private final int b;\n    private final int c;\n\n    Gradebook(String name, int a, int b, int c) {\n        this.name = name;\n        this.a = a;\n        this.b = b;\n        this.c = c;\n    }\n\n    double average() {\n        return (a + b + c) / 3.0;\n    }\n\n    String studentName() {\n        return name;\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String name = sc.nextLine();\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        int c = sc.nextInt();\n        Gradebook gb = new Gradebook(name, a, b, c);\n        System.out.printf(\"%s %.2f\", gb.studentName(), gb.average());\n    }\n}\n" },
        { language: "JavaScript", completeCode: "const fs = require('fs');\nconst lines = fs.readFileSync(0, 'utf8').trim().split(/\\n/);\nconst name = lines[0].trim();\nconst [a, b, c] = lines[1].trim().split(/\\s+/).map(Number);\nclass Gradebook {\n  constructor(name, a, b, c) {\n    this.name = name;\n    this.a = a;\n    this.b = b;\n    this.c = c;\n  }\n  average() {\n    return (this.a + this.b + this.c) / 3;\n  }\n}\nconst gb = new Gradebook(name, a, b, c);\nconsole.log(`${gb.name} ${gb.average().toFixed(2)}`);\n" },
      ],
    },
    {
      title: "Pointer Sum of Two Numbers",
      description:
        "Read two integers, compute their sum using pointer dereferencing, and print the result.\n\nInput:\nTwo integers.\n\nOutput:\nTheir sum.",
      difficulty: "easy",
      subject: "CProgramming",
      tags: "Pointers",
      visibleTestCases: [
        { input: "2 3", output: "5", explanation: "2 + 3 = 5." },
        { input: "10 15", output: "25", explanation: "10 + 15 = 25." },
      ],
      hiddenTestCases: [
        { input: "7 9", output: "16" },
        { input: "100 200", output: "300" },
      ],
      startCode: [
        { language: "C++", initialCode: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    // write your code here using pointers\n    return 0;\n}\n" },
        { language: "Java", initialCode: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        // simulate pointer-style logic with helper objects if needed\n    }\n}\n" },
        { language: "JavaScript", initialCode: "const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\n// write your code here\n" },
      ],
      referenceSolution: [
        { language: "C++", completeCode: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    int *pa = &a;\n    int *pb = &b;\n    cout << (*pa + *pb);\n    return 0;\n}\n" },
        { language: "Java", completeCode: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        System.out.print(a + b);\n    }\n}\n" },
        { language: "JavaScript", completeCode: "const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconst boxA = { value: a };\nconst boxB = { value: b };\nconsole.log((boxA.value + boxB.value).toString());\n" },
      ],
    },
  ];

  const seededProblems = {};
  for (const definition of problems) {
    const problem = await upsertProblem(seedUser, definition);
    seededProblems[definition.subject] = problem;
  }

  await upsertYoutubeVideo(seedUser, seededProblems.OOPs._id, "https://www.youtube.com/watch?v=wN0x9eZLix4");
  await upsertYoutubeVideo(seedUser, seededProblems.CProgramming._id, "https://www.youtube.com/watch?v=KGhacRRMnDw");

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 14);

  await upsertAssignment(seedUser, {
    title: "DAA Greedy Practice Set",
    description: "Solve the greedy scheduling problem and write a short note on why the greedy strategy is optimal for this case.",
    subject: "DAA",
    dueDate: futureDate,
    totalMarks: 100,
    pdfUrl: pdfs.daa,
    problems: [seededProblems.DAA._id],
  });

  await upsertAssignment(seedUser, {
    title: "OOPs Gradebook Mini Project",
    description: "Implement a clean class-based solution and document how encapsulation improves maintainability.",
    subject: "OOPs",
    dueDate: futureDate,
    totalMarks: 100,
    pdfUrl: pdfs.oops,
    problems: [seededProblems.OOPs._id],
  });

  await upsertAssignment(seedUser, {
    title: "C Programming Pointers Worksheet",
    description: "Practice pointer-based input handling, dereferencing, and memory-focused reasoning.",
    subject: "CProgramming",
    dueDate: futureDate,
    totalMarks: 100,
    pdfUrl: pdfs.cprog,
    problems: [seededProblems.CProgramming._id],
  });

  const stats = await Problem.aggregate([{ $group: { _id: "$subject", count: { $sum: 1 } } }]);
  const assignmentStats = await Assignment.aggregate([{ $group: { _id: "$subject", count: { $sum: 1 } } }]);

  console.log(JSON.stringify({ stats, assignmentStats }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
