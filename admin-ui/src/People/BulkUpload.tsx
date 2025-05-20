import { useEffect, useState } from "react";
import {
	Button,
	Link,
	Grid,
	Box,
	Typography,
} from "@mui/material";
import { gql, useApolloClient } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface Entry {
	clientName: string;
	email: string;
}

const registerClientMutation = gql`
  mutation RegisterPerson($input: CreatePersonInput!) {
    createPerson(input: $input) {
      person {
	  rowId
        id
        fullName
        email
        role
		createdAt
      }
    }
  }
`;

const listPeopleQuery = gql`
  query GetAllPeople {
    people {
      nodes {
        id
        rowId
        fullName
        email
        role
      }
    }
  }
`;

export const testPeople = () => {
	const client = useApolloClient();

	useEffect(() => {
		const fetchPeople = async () => {
			try {
				const { data } = await client.query({
					query: listPeopleQuery,
				});
				console.log("People data test:", data.people.nodes[0]);
			} catch (error) {
				console.error("Error fetching people:", error);
			}
		};

		fetchPeople();
	}, [client]);
};

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
	testPeople();
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

			// Perform all mutations concurrently
			const results = await Promise.allSettled(
				entries.map((entry) =>
					client.mutate({
						mutation: registerClientMutation,
						variables: {
							input: {
								person: {
									fullName: entry.clientName,
									email: entry.email,
									role: "APP_USER"
								}
							}
						}
					})
				)
			);
			//Collect any failures
			const failed = results
				.map((result, idx) => ({ result, entry: entries[idx] }))
				.filter(({ result }) => result.status === "rejected")
				.map(({ result, entry }) => `${entry.email}: ${(result as PromiseRejectedResult).reason.message}`);

			if (failed.length > 0) {
				setErrors(failed);
			} else {
				setSuccessMessage("Upload successful!");
				setFile(null);
				navigate("/people");
			}
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