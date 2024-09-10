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
    // Get the orders
    const limitedOrdersObject = await allOrders({ sort: ['lastModifiedAt'] });
    logger.info(`There are ${limitedOrdersObject.total} orders!`);

    // Define the current date
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));

    // Filter orders to include only those from the current day
    const filteredOrders = limitedOrdersObject.results.filter((order: any) => {
      const lastModifiedDate = new Date(order.lastModifiedAt);
      return lastModifiedDate >= todayStart && lastModifiedDate <= todayEnd;
    });

    // Log the count of orders for the current day
    logger.info(`Count of orders for the current day: ${filteredOrders.length}`);

    // Extract order IDs
    const orderIds = filteredOrders.map((order: any) => ({
      orderId: order.id,
    }));

    // Convert order IDs to CSV
    const json2csvParser = new Parser({ fields: ['orderId'] });
    const csv = json2csvParser.parse(orderIds);

    // Define the file name with today's date
    const todayDateStr = new Date().toISOString().split('T')[0];
    const fileName = `${todayDateStr}.csv`;

    // Upload the CSV to AWS S3
    const params = {
      Bucket: bucketName,
      Key: `amalthomson/${fileName}`,
      Body: csv,
      ContentType: 'text/csv',
    };

    await s3.upload(params).promise();

    logger.info(`Order IDs have been uploaded to ${fileName} in ${bucketName}`);
    response.status(200).send('CSV file uploaded successfully!');
  } catch (error: any) {
    logger.error(`Error: ${error.message}`);
    response.status(500).send('Internal Server Error - Error processing orders and uploading to S3');
  }
};
