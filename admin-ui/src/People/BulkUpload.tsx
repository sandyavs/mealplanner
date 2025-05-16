import { useState } from "react";
// import React from "react";
import {
	Button,
	Link,
	Grid,
	Box,
	Typography,
	TextField,
} from "@mui/material";
import { useApolloClient } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface Entry {
	clientName: string;
	email: string;
}

export const DownloadTemplate = () => {
	const handleDownload = () => {
		// CSV headers
		const headers = ["clientName", "email"];

		// Create CSV content as a string
		const csvContent = headers.join(",") + "\n";

		// Create a Blob with CSV content
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

		// Create a link element to trigger download
		const link = document.createElement("a");
		const url = URL.createObjectURL(blob);
		link.href = url;
		link.setAttribute("download", "template.csv");

		// Append to DOM, trigger click, and remove
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		// Release the URL object
		URL.revokeObjectURL(url);
	};

	return (
		<Link onClick={handleDownload} underline="hover" style={{ cursor: 'pointer' }}>
			Download Template
		</Link>
	);


};


export const BulkUpload = () => {
	const [file, setFile] = useState<File | null>(null);
	const [errors, setErrors] = useState<string[]>([]);
	const [successMessage, setSuccessMessage] = useState("");
	const [loading, setLoading] = useState(false);

	const client = useApolloClient();
	const navigate = useNavigate();

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setErrors([]);
		setSuccessMessage("");
		if (e.target.files && e.target.files[0]) {
			setFile(e.target.files[0]);
		}
	};

	const validateEntries = (entries: Entry[]) => {

		const errs: string[] = [];
		if (entries.length > 10000) {
			console.log('entries', entries.length)
			errs.push("File exceeds 10,000 entries limit.");
			return errs;
		}

		entries.forEach((entry, idx) => {
			const lineNumber = idx + 2; // header line 1
			console.log('entry - ', entry, 'index - ', idx)
			// console.log(entry.Name, entry.Email)
			if (entry.clientName?.trim() || entry.email?.trim()) {
				// Validate clientName
				if (!entry.clientName?.trim()) {
					errs.push(`Line ${lineNumber}: Client Name is required.`);
				}

				// Validate email
				if (!entry.email?.trim()) {
					errs.push(`Line ${lineNumber}: Email ID is required.`);
				} else if (!emailRegex.test(entry.email.trim())) {
					errs.push(`Line ${lineNumber}: Invalid Email ID format.`);
				}
			}
		});
		return errs;
	};

	const parseCsvFile = (file: File): Promise<Entry[]> =>
		new Promise((resolve, reject) => {
			Papa.parse<Entry>(file, {
				header: true,
				skipEmptyLines: true,
				complete: (results) => resolve(results.data),
				error: (error) => reject(error),
			});
		});

	const parseExcelFile = (file: File): Promise<Entry[]> =>
		new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const data = e.target?.result;
					if (!data) throw new Error("Failed to read file data");

					const workbook = XLSX.read(data, { type: "array" });
					const sheetName = workbook.SheetNames[0];
					const worksheet = workbook.Sheets[sheetName];
					const jsonData: Entry[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
					resolve(jsonData);
				} catch (err) {
					reject(err);
				}
			};
			reader.onerror = () => reject(new Error("Failed to read file"));
			reader.readAsArrayBuffer(file);
		});

	const handleUpload = async () => {
		if (!file) return;

		setLoading(true);
		setErrors([]);
		setSuccessMessage("");

		try {
			let entries: Entry[] = [];
			const ext = file.name.split(".").pop()?.toLowerCase();

			if (ext === "csv") {
				console.log('file format', 'csv')
				entries = await parseCsvFile(file);
			} else if (ext === "xlsx" || ext === "xls") {
				entries = await parseExcelFile(file);
			} else {
				setErrors(["Unsupported file type"]);
				setLoading(false);
				return;
			}

			const validationErrors = validateEntries(entries);
			if (validationErrors.length) {
				setErrors(validationErrors);
				setLoading(false);
				return;
			}

			// Example: send data via Apollo Client mutation
			// Replace `YOUR_MUTATION` and variables accordingly
			// const { data } = await client.mutate({
			//   mutation: YOUR_MUTATION,
			//   variables: { entries }
			// });

			// Simulate backend upload success
			await new Promise((r) => setTimeout(r, 1000));

			setFile(null);
			navigate("/people"); // or wherever you want to go after upload
			setSuccessMessage("Upload successful!");
		} catch (err: any) {
			setErrors([err.message || "Error processing file"]);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Grid container spacing={2}>
			<Grid item xs={12}>
				<Box display="flex" alignItems="center" gap={2} mt={2}>
					<input
						accept=".csv,.xlsx,.xls"
						type="file"
						id="file-upload"
						style={{ display: "none" }}
						onChange={handleFileChange}
					/>
					<label htmlFor="file-upload">
						<Button variant="outlined" component="span">
							Choose File
						</Button>
						{file && (
							<Typography component="div" mt={0} fontSize="0.875rem" color="textSecondary">
								{file.name}
							</Typography>
						)}
					</label>

					<DownloadTemplate />
				</Box>
			</Grid>

			<Grid item xs={12}>
				<Button
					variant="contained"
					onClick={handleUpload}
					disabled={!file || loading}
				>
					{loading ? "Uploading..." : "Upload"}
				</Button>
			</Grid>

			{errors.length > 0 && (
				<Grid item xs={12}>
					<Box sx={{ color: "red" }}>
						{errors.map((err, idx) => (
							<Typography key={idx}>{err}</Typography>
						))}
					</Box>
				</Grid>
			)}

			{successMessage && (
				<Grid item xs={12}>
					<Typography color="green">{successMessage}</Typography>
				</Grid>
			)}
		</Grid>
	);
};


// export const BulkUpload = () => {
// 	const [file, setFile] = useState<File | null>(null);
// 	const [uploadMessage, setUploadMessage] = useState("");

// 	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
// 		if (event.target.files && event.target.files[0]) {
// 			setFile(event.target.files[0]);
// 			setUploadMessage("");
// 		}
// 	};

// 	const handleUpload = () => {
// 		if (!file) return;

// 		// Replace with your actual upload logic (e.g., using fetch or Apollo mutation)
// 		console.log("Uploading file:", file.name);
// 		setUploadMessage(`Uploaded: ${file.name}`);
// 	};

// 	return (
// 		<Grid container spacing={2}>
// 			<Grid item xs={12}>
// 				<Box mt={4}> {/* 👈 Add vertical space here (mt = margin-top) */}
// 					<input
// 						accept=".csv,.xlsx,.xls"
// 						type="file"
// 						style={{ display: "none" }}
// 						id="file-upload"
// 						onChange={handleFileChange}
// 					/>
// 					<label htmlFor="file-upload">
// 						<Button variant="outlined" component="span">
// 							Choose File
// 						</Button>
// 						{file && <Typography ml={2}>{file.name}</Typography>}
// 					</label>
// 				</Box>
// 			</Grid>

// 			<Grid item xs={12}>
// 				<Button variant="contained" onClick={handleUpload} disabled={!file}>
// 					Upload
// 				</Button>
// 			</Grid>

// 			{uploadMessage && (
// 				<Grid item xs={12}>
// 					<Typography color="green">{uploadMessage}</Typography>
// 				</Grid>
// 			)}
// 		</Grid>
// 	);
// };
