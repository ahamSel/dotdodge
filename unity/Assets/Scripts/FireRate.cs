using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class FireRate : MonoBehaviour
{
    [SerializeField]
    public GameObject shooted;

    float fireRate;
    float nextFire;

    // Start is called before the first frame update
    void Start()
    {
        fireRate = 0.3f;
        nextFire = Time.time;
    }

    // Update is called once per frame
    void Update()
    {
        TimeToFire();
    }

    void TimeToFire()
    {
        if (Time.time > nextFire)
        {
            Instantiate(shooted, transform.position, Quaternion.identity);
            nextFire = Time.time + fireRate;
        }
    }
}
