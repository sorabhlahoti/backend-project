import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken=async function(userId){
  try {
  
    const user=await User.findById(userId)
  
    const accessToken=user.generateAccessToken()
    const refreshToken=user.generateRefreshToken()
   
    user.refreshToken=refreshToken

    await user.save({validateBeforeSave:false})

    return {accessToken,refreshToken}

  } catch (error) {
    throw new ApiError(500,"Something Went Wrong while generating refresh and access token")
  }
}

const registerUser=asyncHandler(async (req,res)=>{

  //get user details from frontend
  //validate - not  empty
  //check if user already exist: username,email 
  //check for images and check for avatar
  //upload them to cloudinary =>check avatar is uploaded
  //create user object -> entry in db
  //remove password and refreshtoken field from response
  //check for user creation
  //return response 


  const {fullName,email,username,password}=req.body
  
  if ([fullName, email,username,password].some((field)=>
    field?.trim()===""
  )){
    throw new ApiError(400,"All fields are required")
  }


  const existedUser=await User.findOne({
    $or:[{email},{username}]
  })

  if (existedUser){
    throw new ApiError(409,"User with email or username already exists")
  }
  
  const avatarLocalPath=req?.files?.avatar?.[0]?.path;

  const coverImageLocalPath=req?.files?.coverImage?.[0]?.path

  if (!avatarLocalPath){
    throw new ApiError(400,"Avatar file is required here ")
  }
  
  const avatar=await uploadOnCloudinary(avatarLocalPath)
  const coverImage=await uploadOnCloudinary(coverImageLocalPath)

  if (!avatar){
    throw new ApiError(400,"Avatar file is required")
  }

  const user=await User.create({
    fullName,
    avatar:avatar.url,
    coverImage:coverImage?.url || "",
    email,
    username:username.toLowerCase(),
    password:password
  })

  const createUser=await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if (!createUser){
    throw new ApiError(500,"Something went wrong while registering the user") 
  }

  return res.status(201).json(
    new ApiResponse(200,createUser,"User registered Successfully")
  )
})

const loginUser=asyncHandler(async (req,res)=>{

  //req body username or email and password
  //find the user
  //is password check
  //access token and refresh token
  //send cookie

  const {email,password,username}=req.body

  if (!username && !email){
    throw new ApiError(400,"username or email is required")
  }

  const user=await User.findOne({
    $or:[{username},{email}]
  })

  if (!user){
    throw new ApiError(404,"User does not exist")
  }

  const isPasswordValid=await user.isPasswordCorrect(password)

  if(!isPasswordValid){
    throw new ApiError(401,"Invalid user credentials")
  }

  const {accessToken,
    refreshToken}=await generateAccessAndRefreshToken(user._id)
  
  const loggedInUser=await User.findById(user._id).select(
    "-password -refreshToken"
  )

  const options={
    httpOnly:true,
    secure:true,
  } 
 
  return res.status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(
      200,
      {
        user:loggedInUser,accessToken,
        refreshToken
      },
      "User logged in Successfully"
    )
  )

})

const logoutUser=asyncHandler(async(req,res)=>{
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        refreshToken:undefined
      }
    },
    {
      new:true
    }
  )

  const options={
    httpOnly:true,
    secure:true,
  } 

  return res.status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200 ,{},"User logged Out"))

})

const refreshAccessToken=asyncHandler(async(req,res)=>{
  const incomingRefreshToken=req.cookies.refreshAccessToken|| req.body.refreshToken

  if (!incomingRefreshToken){
    throw new ApiError(401,"unauthorized request")
  }

 try {
   const decodedToken=jwt.verify(
     incomingRefreshToken,
     process.env.REFRESH_TOKEN_SECRET
   )
 
   const user=await User.findById(decodedToken?._id)
 
   if (!user){
     throw new ApiError(401,"Invalid refresh Token")
   }
 
   if (incomingRefreshToken!==user?.refreshToken){
     throw new  ApiError(401,"Refresh token is expired or used")
   }
 
   const options={
     httpOnly:true,
     secure:true
   }
   
   const {accessToken,newRefreshToken}=await generateAccessAndRefreshToken(user._id)
 
   return res
   .status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",refreshToken,options)
   .json(
     new ApiResponse(
       200,
       {accessToken,refreshToken:newRefreshToken},
       "Access token refreshed"
     )
   )
 } catch (error) {
    throw new ApiError(401,error?.message||"Invalid refresh token")
 }

})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken
}