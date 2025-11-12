
import vector1 from "../../assests/vector1.png";

const bgstyle2 = {
  backgroundImage: `url(${vector1})`,
  height: "100%",
  width: "100%",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "cover",
};
const About = () => {
  return (
    <>
     <div  className="relative py-14 ">
      <div className="container py-4">
        <div>
          <div className="text-center text-4xl font-bold text-cyan-950">
            Why Choose Us
          </div>
          {/* column 1*/}
          <div className="pt-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 place-items-center gap-4">
              <div
                style={bgstyle2}
                className="rounded-3xl overflow-hidden shadow-2xl"
              >
                <img src={vector1} alt="" className="w-full " />
              </div>
              <div>
                <div className="text-3xl font-semibold text-cyan-950 ">
                  Scan or Upload Image
                </div>
                <p className="py-4 font-semibold text-cyan-950">
                  Our website is build to identify waste images and define their type of waste . Users just has to upload
                  waste image item or take image from camera on website which will classify the image and give instant results and works
                  both on desktop and mobile devices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default About