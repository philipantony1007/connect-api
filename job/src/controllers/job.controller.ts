import { Request, Response } from 'express';
import { S3 } from 'aws-sdk';
import { Parser } from 'json2csv';
import { logger } from '../utils/logger.utils';
import { allOrders } from '../orders/fetch.orders';

// Configure AWS SDK with credentials from environment variables
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: 'us-east-1',
});

const bucketName = 'innovation-training-2024';

export const post = async (_request: Request, response: Response) => {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // e.g., "2024-09-10"

    // Fetch orders created on the current day only
    const limitedOrdersObject = await allOrders({
      where: `createdAt >= "${todayStr}T00:00:00Z" and createdAt <= "${todayStr}T23:59:59Z"`,
    });

    logger.info(`There are ${limitedOrdersObject.total} orders created today!`);

    // Extract order IDs for CSV
    const orderIds = limitedOrdersObject.results.map((order: any) => ({
      orderId: order.id,
    }));

    // Convert order IDs to CSV
    const json2csvParser = new Parser({ fields: ['orderId'] });
    const csv = json2csvParser.parse(orderIds);

    // Define the file name with today's date
    const fileName = `${todayStr}-orders.csv`;

    // Upload the CSV to AWS S3
    const uploadParams = {
      Bucket: bucketName,
      Key: `philip/${fileName}`,
      Body: csv,
      ContentType: 'text/csv',
    };

    await s3.upload(uploadParams).promise();

    logger.info(`Order IDs have been uploaded to ${fileName} in ${bucketName}`);
    response.status(200).send({ message: 'CSV file uploaded successfully to AWS S3!' });

  } catch (error: any) {
    logger.error(`Error: ${error.message}`);
    response.status(500).send('Internal Server Error - Error processing orders and uploading to S3');
  }
};
