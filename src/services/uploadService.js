const AWS = require('@aws-sdk/client-ses');
const { v4: uuidv4 } = require('uuid');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class UploadService {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
    this.bucket = process.env.AWS_S3_BUCKET;
  }

  async uploadFile(file, userId, type) {
    try {
      const fileExtension = file.originalname.split('.').pop();
      const key = `${userId}/${type}/${uuidv4()}.${fileExtension}`;

      const params = {
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'private'
      };

      const result = await this.s3.upload(params).promise();
      return result.Location;
    } catch (error) {
      logger.error('File upload error:', error);
      throw new ValidationError('File upload failed');
    }
  }

  async deleteFile(fileUrl) {
    try {
      const key = fileUrl.split('/').slice(-2).join('/');
      
      const params = {
        Bucket: this.bucket,
        Key: key
      };

      await this.s3.deleteObject(params).promise();
    } catch (error) {
      logger.error('File deletion error:', error);
      throw new ValidationError('File deletion failed');
    }
  }

  getSignedUrl(key) {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: 3600 // URL expires in 1 hour
    });
  }
}

module.exports = new UploadService(); 